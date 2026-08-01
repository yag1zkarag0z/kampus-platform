CREATE TYPE "public"."listing_condition" AS ENUM('new', 'lightly_used', 'used');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('sale', 'wanted', 'free');--> statement-breakpoint
CREATE TABLE "listings" (
	"post_id" uuid PRIMARY KEY NOT NULL,
	"type" "listing_type" NOT NULL,
	"condition" "listing_condition" NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_price_check" CHECK ((
        "listings"."type" = 'free' and "listings"."price" = 0
      ) or (
        "listings"."type" <> 'free'
        and "listings"."price" between 1 and 1000000
      ))
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_type_price_idx" ON "listings" USING btree ("type","price");