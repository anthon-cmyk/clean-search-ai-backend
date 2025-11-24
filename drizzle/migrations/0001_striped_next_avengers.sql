CREATE TABLE "google_ads_ad_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_db_id" uuid NOT NULL,
	"campaign_id" text NOT NULL,
	"ad_group_id" text NOT NULL,
	"ad_group_name" text NOT NULL,
	"status" text NOT NULL,
	"type" text,
	"cpc_bid_micros" integer,
	"target_cpa_micros" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_ads_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ads_customer_id" uuid NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"status" text NOT NULL,
	"bidding_strategy_type" text,
	"advertising_channel_type" text,
	"budget_amount_micros" integer,
	"currency_code" text,
	"start_date" text,
	"end_date" text,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"cost" numeric(12, 2) DEFAULT '0',
	"conversions" numeric(10, 2) DEFAULT '0',
	"conversions_value" numeric(12, 2) DEFAULT '0',
	"ctr" numeric(5, 4) DEFAULT '0',
	"average_cpc" numeric(10, 2) DEFAULT '0',
	"average_cpm" numeric(10, 2) DEFAULT '0',
	"metrics_start_date" text,
	"metrics_end_date" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_ads_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_group_db_id" uuid NOT NULL,
	"ad_group_id" text NOT NULL,
	"keyword_id" text NOT NULL,
	"keyword_text" text NOT NULL,
	"match_type" text NOT NULL,
	"status" text NOT NULL,
	"final_urls" text[],
	"cpc_bid_micros" integer,
	"quality_score" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "google_ads_ad_groups" ADD CONSTRAINT "google_ads_ad_groups_campaign_db_id_google_ads_campaigns_id_fk" FOREIGN KEY ("campaign_db_id") REFERENCES "public"."google_ads_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_ads_campaigns" ADD CONSTRAINT "google_ads_campaigns_ads_customer_id_google_ads_customers_id_fk" FOREIGN KEY ("ads_customer_id") REFERENCES "public"."google_ads_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_ads_keywords" ADD CONSTRAINT "google_ads_keywords_ad_group_db_id_google_ads_ad_groups_id_fk" FOREIGN KEY ("ad_group_db_id") REFERENCES "public"."google_ads_ad_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_groups_campaign_db_id_idx" ON "google_ads_ad_groups" USING btree ("campaign_db_id");--> statement-breakpoint
CREATE INDEX "ad_groups_ad_group_id_idx" ON "google_ads_ad_groups" USING btree ("ad_group_id");--> statement-breakpoint
CREATE INDEX "ad_groups_status_idx" ON "google_ads_ad_groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "campaigns_ads_customer_id_idx" ON "google_ads_campaigns" USING btree ("ads_customer_id");--> statement-breakpoint
CREATE INDEX "campaigns_campaign_id_idx" ON "google_ads_campaigns" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "google_ads_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "keywords_ad_group_db_id_idx" ON "google_ads_keywords" USING btree ("ad_group_db_id");--> statement-breakpoint
CREATE INDEX "keywords_keyword_id_idx" ON "google_ads_keywords" USING btree ("keyword_id");--> statement-breakpoint
CREATE INDEX "keywords_keyword_text_idx" ON "google_ads_keywords" USING btree ("keyword_text");--> statement-breakpoint
CREATE INDEX "keywords_status_idx" ON "google_ads_keywords" USING btree ("status");--> statement-breakpoint
ALTER TABLE "search_terms" DROP COLUMN "keyword";