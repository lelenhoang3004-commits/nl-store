/**
 * Base service.
 * Business services will extend this class when feature modules are introduced.
 */
export class BaseService {
  constructor(repository = null) {
    this.repository = repository;
  }
}
