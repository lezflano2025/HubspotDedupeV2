// Shared set of system property keys returned by HubSpot that should be hidden by default
// across contacts and companies. Keys are stored in lowercase for case-insensitive checks.
export const SYSTEM_PROPERTY_KEYS = new Set<string>([
  'hs_object_id',
  'hs_createdate',
  'hs_lastmodifieddate',
  'createdate',
  'lastmodifieddate',
  'hs_all_owner_ids',
  'hs_all_team_ids',
  'hs_all_accessible_team_ids',
  'hs_created_by_user_id',
  'hs_updated_by_user_id',
  'hs_object_source',
  'hs_object_source_id',
  'hs_object_source_label',
  'hs_user_ids_of_all_notification_followers',
  'hs_user_ids_of_all_notification_unfollowers',
  'hs_user_ids_of_all_owners',
  'hs_read_only',
  'hs_pinned_engagement_id',
  'hs_merged_object_ids',
  'hs_is_externally_synced',
]);
