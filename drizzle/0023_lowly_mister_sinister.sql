CREATE TABLE "document_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"mime_type" varchar(32) NOT NULL,
	"size_bytes" integer NOT NULL,
	"file_name" varchar(160) NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_assets_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "document_assets_pdf_metadata_check" CHECK ("document_assets"."mime_type" = 'application/pdf'
        and "document_assets"."size_bytes" between 1 and 8388608
        and char_length(btrim("document_assets"."file_name")) > 0
        and "document_assets"."checksum" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "post_documents" (
	"post_id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_documents_asset_id_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_documents" ADD CONSTRAINT "post_documents_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_documents" ADD CONSTRAINT "post_documents_asset_id_document_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."document_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_assets_owner_created_at_idx" ON "document_assets" USING btree ("owner_id","created_at" DESC NULLS LAST);