export type ApiCollection = {
  _id: number;
  parent?: {
    $id: number;
  };
  title: string;
};

export type ApiTag = {
  _id?: string;
  count?: number;
  title?: string;
};

export type ApiBookmark = {
  _id: number;
  collection?: {
    $id: number;
  };
  cover?: string;
  created?: string;
  excerpt?: string;
  lastUpdate?: string;
  link?: string;
  tags?: string[];
  title?: string;
  type?: string;
};
