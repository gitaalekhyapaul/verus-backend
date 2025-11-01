import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase service class for interacting with Supabase.
 */
export class SupabaseService {
  private static instance: SupabaseService | undefined;
  private client: SupabaseClient;

  /**
   * Private constructor to create a new Supabase service.
   * Initializes the client with the URL and key from the environment variables.
   */
  private constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("SUPABASE_URL and SUPABASE_KEY must be set");
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Gets the singleton instance of the Supabase service.
   * If the instance does not exist, it creates a new one.
   *
   * @returns The singleton instance of the Supabase service.
   */
  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  /**
   * Gets the client for the Supabase service.
   *
   * @returns The client for the Supabase service.
   */
  public getClient(): SupabaseClient {
    return this.client;
  }
}
