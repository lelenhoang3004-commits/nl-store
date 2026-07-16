/**
 * API response formatter.
 * A single response shape keeps REST endpoints consistent when APIs are added later.
 */
export class ApiResponse {
  static success(data = null, message = "Success", meta = null, statusCode = 200) {
    return {
      success: true,
      statusCode,
      message,
      data,
      meta,
      timestamp: new Date().toISOString()
    };
  }

  static error(message = "Error", code = "ERROR", details = null, statusCode = 500) {
    return {
      success: false,
      statusCode,
      message,
      error: {
        code,
        details
      },
      timestamp: new Date().toISOString()
    };
  }

  static meta({ pagination = null, search = null, sort = null, filter = null } = {}) {
    return {
      pagination,
      search,
      sort,
      filter
    };
  }
}
