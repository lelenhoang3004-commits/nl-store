/**
 * Base repository.
 * Repositories own database access later; this base only stores the connection pool reference.
 */
import { databaseClient } from "../utils/database.util.js";

export class BaseRepository {
  constructor(client = databaseClient) {
    this.client = client;
  }
}
