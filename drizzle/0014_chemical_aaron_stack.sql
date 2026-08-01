ALTER TABLE "comments" ADD CONSTRAINT "comments_gif_metadata_check" CHECK (("comments"."gif_id" is null
          and "comments"."gif_url" is null
          and "comments"."gif_width" is null
          and "comments"."gif_height" is null
          and "comments"."gif_alt" is null)
        or ("comments"."gif_id" is not null
          and "comments"."gif_url" like 'https://%'
          and "comments"."gif_width" between 1 and 4096
          and "comments"."gif_height" between 1 and 4096
          and char_length(btrim("comments"."gif_alt")) > 0));--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_gif_metadata_check" CHECK (("posts"."gif_id" is null
          and "posts"."gif_url" is null
          and "posts"."gif_width" is null
          and "posts"."gif_height" is null
          and "posts"."gif_alt" is null)
        or ("posts"."gif_id" is not null
          and "posts"."gif_url" like 'https://%'
          and "posts"."gif_width" between 1 and 4096
          and "posts"."gif_height" between 1 and 4096
          and char_length(btrim("posts"."gif_alt")) > 0));