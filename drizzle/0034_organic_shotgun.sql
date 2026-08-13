ALTER TABLE "analytics_events" ADD COLUMN "activity_date" date;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_events_daily_activity_unique" ON "analytics_events" USING btree ("subject","name","activity_date") WHERE "analytics_events"."activity_date" is not null;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_name_check" CHECK ("analytics_events"."name" in (
        'account_registered', 'session_started', 'user_active_day',
        'post_created', 'comment_created', 'follow_created', 'message_sent'
      ));--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_activity_shape_check" CHECK ((
        "analytics_events"."name" = 'user_active_day'
        and "analytics_events"."subject" is not null
        and "analytics_events"."activity_date" is not null
      ) or (
        "analytics_events"."name" <> 'user_active_day'
        and "analytics_events"."activity_date" is null
      ));