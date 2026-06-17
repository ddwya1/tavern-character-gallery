# 后端说明

后端只做本地文件访问，不负责账号、聊天或远程同步。

主要接口：

- `GET /api/health`
- `GET /api/taverns/scan`
- `POST /api/taverns/select`
- `GET /api/characters`
- `POST /api/characters/preview`
- `POST /api/characters/import`
- `POST /api/characters/import-blob`
- `POST /api/characters/save-as`
- `DELETE /api/characters`

扫描逻辑会跳过 `node_modules`、`.git`、构建产物、系统目录和常见缓存目录。导入角色卡时不会覆盖同名文件，会自动追加序号。

