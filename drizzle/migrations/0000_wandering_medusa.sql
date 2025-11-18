CREATE TYPE "public"."sync_job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "google_ads_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"oauth_connection_id" uuid NOT NULL,
	"customer_id" text NOT NULL,
	"customer_name" text,
	"customer_descriptive_name" text,
	"is_manager_account" boolean DEFAULT false NOT NULL,
	"manager_customer_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp,
	"account_level" text,
	"currency_code" text,
	"time_zone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_customer_unique" UNIQUE("oauth_connection_id","customer_id")
);
--> statement-breakpoint
CREATE TABLE "google_oauth_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"google_email" text NOT NULL,
	"google_user_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"scopes" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "google_oauth_connections_google_user_id_unique" UNIQUE("google_user_id")
);
--> statement-breakpoint
CREATE TABLE "llm_processing_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_term_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"llm_response" text NOT NULL,
	"llm_model" text NOT NULL,
	"structured_response" jsonb,
	"token_usage" jsonb,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ads_customer_id" uuid NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"ad_group_id" text NOT NULL,
	"ad_group_name" text NOT NULL,
	"search_term" text NOT NULL,
	"keyword" text NOT NULL,
	"metrics" jsonb,
	"fetched_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ads_customer_id" uuid NOT NULL,
	"status" "sync_job_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"records_processed" integer DEFAULT 0,
	"error_message" text,
	"error_details" jsonb,
	"sync_start_date" text,
	"sync_end_date" text,
	"sync_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "google_ads_customers" ADD CONSTRAINT "google_ads_customers_oauth_connection_id_google_oauth_connections_id_fk" FOREIGN KEY ("oauth_connection_id") REFERENCES "public"."google_oauth_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_processing_results" ADD CONSTRAINT "llm_processing_results_search_term_id_search_terms_id_fk" FOREIGN KEY ("search_term_id") REFERENCES "public"."search_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_terms" ADD CONSTRAINT "search_terms_ads_customer_id_google_ads_customers_id_fk" FOREIGN KEY ("ads_customer_id") REFERENCES "public"."google_ads_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_ads_customer_id_google_ads_customers_id_fk" FOREIGN KEY ("ads_customer_id") REFERENCES "public"."google_ads_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "google_ads_customers_oauth_connection_id_idx" ON "google_ads_customers" USING btree ("oauth_connection_id");--> statement-breakpoint
CREATE INDEX "google_ads_customers_customer_id_idx" ON "google_ads_customers" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "google_oauth_connections_user_id_idx" ON "google_oauth_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "google_oauth_connections_google_user_id_idx" ON "google_oauth_connections" USING btree ("google_user_id");--> statement-breakpoint
CREATE INDEX "llm_results_search_term_id_idx" ON "llm_processing_results" USING btree ("search_term_id");--> statement-breakpoint
CREATE INDEX "llm_results_created_at_idx" ON "llm_processing_results" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "search_terms_ads_customer_id_idx" ON "search_terms" USING btree ("ads_customer_id");--> statement-breakpoint
CREATE INDEX "search_terms_campaign_id_idx" ON "search_terms" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "search_terms_search_term_idx" ON "search_terms" USING btree ("search_term");--> statement-breakpoint
CREATE INDEX "search_terms_fetched_at_idx" ON "search_terms" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "sync_jobs_ads_customer_id_idx" ON "sync_jobs" USING btree ("ads_customer_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_jobs_created_at_idx" ON "sync_jobs" USING btree ("created_at");