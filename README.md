# 电音风格图鉴

这是 `electromusic.illusix6.com` 的网站源码。网站使用纯静态 HTML、CSS 和 JavaScript，不需要安装依赖。

## 日常维护

最常修改的文件是 `dist/content.json`：

- `concerts`：线上音乐会列表。新增项目后，网页会自动按 `date` 从新到旧排序，并自动计算场次、曲风和参与人数。
- `submission`：投稿说明、投稿要求、邮箱及备用联系方式。
- `about`：维护者、资料来源和反馈方式。

曲风分类和推荐歌曲保存在 `dist/genres.json`。页面样式保存在 `dist/styles.css`。

编辑 JSON 时请注意：

1. 每个字段使用英文双引号。
2. 同一组中的项目之间要有英文逗号。
3. 最后一个项目后面不要添加逗号。
4. 提交前可使用 JSON 校验工具检查格式。

## 自动发布

推送到 `main` 分支后，`.github/workflows/pages.yml` 会自动把 `dist` 文件夹发布到 GitHub Pages。可在仓库的 Actions 页面查看发布进度。

## 本地预览

进入项目目录后运行：

```sh
python3 -m http.server 4173 --directory dist
```

然后打开 `http://127.0.0.1:4173`。

## 域名

正式切换到 GitHub Pages 后，需要在仓库的 Settings → Pages 中设置自定义域名 `electromusic.illusix6.com`，并把阿里云的 `electromusic` CNAME 记录改为 GitHub Pages 提供的目标地址。
