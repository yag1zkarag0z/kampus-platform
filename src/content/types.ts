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
  liked: false;
  bookmarked: false;
  selectedPollOptionId: null;
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
