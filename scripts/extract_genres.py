#!/usr/bin/env python3
"""Extract the genre outline and compact metadata from the source DOCX."""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn


ROOTS = [
    ("House", "House"),
    ("Techno", "Techno"),
    ("Trance", "Trance"),
    ("Breakbeat", "Breakbeat"),
    ("UK Bass", "UK Bass"),
    ("US Bass", "US Bass"),
    ("HDM", "HDM"),
    ("Hip-Hop/Trap/Future Bass", "Hip-Hop/Trap/Future Bass"),
    ("Disco/Hi-NRG", "Disco/Hi-NRG"),
    ("Ambient", "Ambient"),
    ("Indie", "Indie"),
    ("Post-Internet", "Post-Internet"),
    ("Industrial Music", "Industrial Music"),
    ("早期流派/手法/理念", "早期流派/手法/理念"),
    ("Ethnic", "Ethnic"),
    ("Fusion", "Fusion"),
]


def outline_level(paragraph):
    ppr = paragraph._p.pPr
    if ppr is None:
        return None
    item = ppr.find(qn("w:outlineLvl"))
    if item is None:
        return None
    return int(item.get(qn("w:val")))


def strip_status(text: str) -> tuple[str, str | None]:
    text = text.strip()
    note_parts: list[str] = []
    patterns = [
        r"[（(]\s*已完成\s*[）)]",
        r"[（(][^）)]*(?:不选入视频|不加入视频|视频不选|见[^）)]*篇章)[^）)]*[）)]",
    ]
    cleaned = text
    for pattern in patterns:
        for match in re.findall(pattern, cleaned, flags=re.I):
            note_parts.append(match.strip("（）() "))
        cleaned = re.sub(pattern, "", cleaned, flags=re.I)
    return cleaned.strip(), "；".join(note_parts) or None


def split_values(value: str) -> list[str]:
    value = re.sub(r"(?:\betc\.?|等)$", "", value.strip(), flags=re.I)
    value = value.rstrip("。；;，,")
    if not value:
        return []
    return [part.strip() for part in re.split(r"[、，,；;]", value) if part.strip()]


def clean_track(text: str) -> str:
    text = re.sub(r"^(?:例曲|推荐曲目|曲目)\s*[：:]\s*", "", text.strip())
    text = re.sub(r"[【\[]https?://.*?[】\]]", "", text)
    text = re.sub(r"\s*https?://\S+", "", text)
    return re.sub(r"\s+", " ", text).strip(" ·；;")


def looks_like_track(text: str) -> bool:
    text = clean_track(text)
    if not text or len(text) > 220:
        return False
    return bool(re.search(r"\s[-–—]\s", text))


def metadata_between(paragraphs, start: int, end: int) -> dict:
    aliases: list[str] = []
    upper: list[str] = []
    lower: list[str] = []
    related: list[str] = []
    tracks: list[str] = []
    collecting_tracks = False

    for paragraph in paragraphs[start:end]:
        text = paragraph.text.strip()
        if not text:
            continue
        normalized = text.replace("：", ":")
        if re.match(r"^A\.?\s*K\.?\s*A\.?:", normalized, flags=re.I):
            value = normalized.split(":", 1)[1]
            aliases.extend(split_values(value))
            collecting_tracks = False
        elif normalized.startswith("上位:"):
            upper.extend(split_values(normalized.split(":", 1)[1]))
            collecting_tracks = False
        elif normalized.startswith("下位:"):
            lower.extend(split_values(normalized.split(":", 1)[1]))
            collecting_tracks = False
        elif re.match(r"^Related\s*To:", normalized, flags=re.I):
            related.extend(split_values(normalized.split(":", 1)[1]))
            collecting_tracks = False
        elif re.match(r"^(?:例曲|推荐曲目|曲目)\s*:", normalized):
            candidate = clean_track(text)
            if candidate:
                tracks.append(candidate)
            collecting_tracks = True
        elif collecting_tracks and looks_like_track(text):
            tracks.append(clean_track(text))
        elif collecting_tracks:
            collecting_tracks = False

    def unique(values):
        seen = set()
        result = []
        for value in values:
            key = value.casefold()
            if key not in seen:
                seen.add(key)
                result.append(value)
        return result

    return {
        "aliases": unique(aliases),
        "upper": unique(upper),
        "lower": unique(lower),
        "related": unique(related),
        "tracks": unique(tracks)[:3],
    }


def extract(source: Path) -> dict:
    doc = Document(str(source))
    paragraphs = doc.paragraphs
    headings = []
    for index, paragraph in enumerate(paragraphs):
        level = outline_level(paragraph)
        text = paragraph.text.strip()
        if level is not None and text:
            headings.append((index, level, text))

    root_indices = []
    root_lookup = {name.casefold(): (name, display) for name, display in ROOTS}
    for position, (index, level, raw) in enumerate(headings):
        if level != 0:
            continue
        cleaned, _ = strip_status(raw)
        base = cleaned.split("（", 1)[0].strip().casefold()
        if base in root_lookup:
            root_indices.append((position, root_lookup[base]))

    nodes = []
    duplicate_counter = Counter()
    root_ids = []

    for root_number, (heading_position, (canonical, display)) in enumerate(root_indices, start=1):
        end_heading_position = next(
            (candidate for candidate in range(heading_position + 1, len(headings)) if headings[candidate][1] == 0),
            len(headings),
        )
        root_id = f"chapter-{root_number:02d}"
        root_ids.append(root_id)
        nodes.append({
            "id": root_id,
            "name": display,
            "rawName": headings[heading_position][2],
            "chapter": root_id,
            "parent": None,
            "level": 0,
            "note": None,
            "aliases": [],
            "upper": [],
            "lower": [],
            "related": [],
            "tracks": [],
        })

        stack = {0: root_id}
        section_headings = headings[heading_position + 1:end_heading_position]
        for local_pos, (paragraph_index, level, raw_name) in enumerate(section_headings):
            clean_name, note = strip_status(raw_name)
            if clean_name in {"前言", "大纲"}:
                continue
            if not clean_name:
                continue

            next_paragraph_index = (
                section_headings[local_pos + 1][0]
                if local_pos + 1 < len(section_headings)
                else (headings[end_heading_position][0] if end_heading_position < len(headings) else len(paragraphs))
            )
            meta = metadata_between(paragraphs, paragraph_index + 1, next_paragraph_index)
            parent_levels = [candidate for candidate in stack if candidate < level]
            parent_level = max(parent_levels) if parent_levels else 0
            parent_id = stack[parent_level]

            base_key = re.sub(r"[^a-z0-9]+", "-", clean_name.casefold()).strip("-") or "genre"
            duplicate_counter[(root_id, base_key)] += 1
            suffix = duplicate_counter[(root_id, base_key)]
            node_id = f"{root_id}-{base_key}" + (f"-{suffix}" if suffix > 1 else "")
            nodes.append({
                "id": node_id,
                "name": clean_name,
                "rawName": raw_name,
                "chapter": root_id,
                "parent": parent_id,
                "level": level,
                "note": note,
                **meta,
            })
            stack[level] = node_id
            for old_level in [candidate for candidate in stack if candidate > level]:
                del stack[old_level]

    children = Counter(node["parent"] for node in nodes if node["parent"])
    for node in nodes:
        node["childCount"] = children[node["id"]]

    return {
        "title": "电音风格图鉴",
        "source": source.name,
        "rootIds": root_ids,
        "nodes": nodes,
        "stats": {
            "chapters": len(root_ids),
            "genres": len(nodes) - len(root_ids),
            "tracks": sum(len(node["tracks"]) for node in nodes),
            "maxLevel": max(node["level"] for node in nodes),
        },
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_genres.py SOURCE.docx OUTPUT.json")
    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    output.parent.mkdir(parents=True, exist_ok=True)
    data = extract(source)
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(data["stats"], ensure_ascii=False))


if __name__ == "__main__":
    main()
