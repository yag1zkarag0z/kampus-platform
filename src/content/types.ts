export type ContentPostCategory =
  | "chat"
  | "confession"
  | "question"
  | "event"
  | "lost_found"
  | "poll"
  | "listing";

export type ContentAuthorDto = {
  id: string | null;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export type ContentViewerStateDto = {
  isAuthor: boolean;
  canEdit: boolean;
  canDelete: boolean;
  liked: boolean;
  bookmarked: boolean;
  selectedPollOptionId: string | null;
};

export type ContentPollOptionDto = {
  id: string;
  text: string;
  voteCount: number;
};

export type ContentPollDto = {
  id: string;
  totalVotes: number;
  options: ContentPollOptionDto[];
};

export type ContentListingType = "sale" | "wanted" | "free";
export type ContentListingCondition = "new" | "lightly_used" | "used";

export type ContentListingDto = {
  type: ContentListingType;
  condition: ContentListingCondition;
  price: number;
};

export type ContentPostDto = {
  id: string;
  category: ContentPostCategory;
  isAnonymous: boolean;
  title: string;
  body: string;
  author: ContentAuthorDto;
  createdAt: string;
  editedAt: string | null;
  likeCount: number;
  commentCount: number;
  poll?: ContentPollDto | null;
  listing?: ContentListingDto | null;
  viewerState: ContentViewerStateDto;
};

export type ContentCommentDto = {
  id: string;
  postId: string;
  parentId: string | null;
  isAnonymous: boolean;
  isDeleted: boolean;
  body: string | null;
  author: ContentAuthorDto;
  createdAt: string;
  editedAt: string | null;
  viewerState: {
    isAuthor: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
};

export type ContentPostDetailDto = ContentPostDto & {
  comments: ContentCommentDto[];
};

export type ContentPostPageDto = {
  nextCursor: string | null;
  hasMore: boolean;
};

export type ContentPostListDto = {
  data: ContentPostDto[];
  page: ContentPostPageDto;
};
