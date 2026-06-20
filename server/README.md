# 后端说明

后端是一个 Express 服务，只负责本地文件访问和角色卡处理。

它不会登录账号，不处理聊天模型，也不做远程同步。

## 主要接口

- `GET /api/health`：健康检查。
- `GET /api/taverns/scan`：扫描本机可能的 SillyTavern 目录。
- `POST /api/taverns/select`：选择当前使用的酒馆路径。
- `GET /api/characters`：读取当前酒馆和待导入角色卡列表。
- `GET /api/characters/cover/:encoded`：读取角色卡封面。
- `POST /api/characters/preview`：预览本地角色卡。
- `POST /api/characters/import`：导入待导入角色卡。
- `POST /api/characters/import-blob`：上传并导入角色卡文件。
- `POST /api/characters/save-as`：另存角色卡。
- `DELETE /api/characters`：删除角色卡。

## 文件处理

扫描时会跳过 `node_modules`、`.git`、构建产物、系统目录和常见缓存目录。

导入角色卡时不会覆盖同名文件。如果目标目录已有同名文件，后端会自动追加序号。

封面接口只允许读取当前酒馆 `characters` 目录下的图片，避免随便读本机其他文件。
