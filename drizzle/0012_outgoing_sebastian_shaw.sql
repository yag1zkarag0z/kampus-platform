CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"mime_type" varchar(32) NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "media_assets_image_metadata_check" CHECK ("media_assets"."mime_type" = 'image/webp'
        and "media_assets"."size_bytes" between 1 and 1048576
        and "media_assets"."width" between 1 and 4096
        and "media_assets"."height" between 1 and 4096
        and "media_assets"."checksum" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "post_images" (
	"post_id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid NOT NULL,
	"alt" varchar(160) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_images_asset_id_unique" UNIQUE("asset_id"),
	CONSTRAINT "post_images_alt_not_blank_check" CHECK (char_length(btrim("post_images"."alt")) > 0)
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_owner_created_at_idx" ON "media_assets" USING btree ("owner_id","created_at" DESC NULLS LAST);