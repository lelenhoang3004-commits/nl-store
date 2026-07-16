# Backend Architecture

This backend is an MVC-oriented Node.js and Express architecture prepared for MySQL.
It intentionally contains no business API, CRUD implementation, SQL statement, or authentication logic yet.

## Folder Responsibilities

- `config/`: Centralized application and MySQL configuration.
- `controllers/`: HTTP controller layer. Controllers receive validated requests and return API responses.
- `middleware/`: Express middleware for security, request logging, validation, 404, and error handling.
- `models/`: Domain model classes and serialization helpers.
- `repositories/`: Database access layer. Future repositories will own MySQL queries.
- `services/`: Business use-case layer. Services coordinate domain rules and repositories.
- `routes/`: Route registry. Feature routers will be mounted here after API approval.
- `validators/`: Request validation helpers and future module validators.
- `utils/`: Shared utilities such as response formatting, application errors, logging, and async wrappers.
- `uploads/`: Runtime upload directory prepared for future Multer integration.
- `public/`: Public static backend assets.
- `logs/`: Runtime log output directory if file logging is added later.
- `app.js`: Express application composition.
- `server.js`: HTTP server bootstrap and graceful shutdown.
- `.env.example`: Required environment variables template.
- `package.json`: Backend dependencies and scripts.

## Request Flow

```text
Request
↓
Route
↓
Middleware
↓
Validation
↓
Controller
↓
Service
↓
Repository
↓
MySQL
↓
Response
```

## Extension Rules

- Add new API modules by creating route, validator, controller, service, repository, and model files.
- Keep SQL inside repositories only.
- Keep business rules inside services only.
- Keep HTTP request and response logic inside controllers only.
- Register feature routers in `routes/index.js`.
- Throw `AppError` for expected errors and let `errorHandler` normalize the response.
