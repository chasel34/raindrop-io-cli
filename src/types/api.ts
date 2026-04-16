export type ApiCollection = {
  _id: number;
  parent?: {
    $id: number;
  };
  public?: boolean;
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
  important?: boolean;
  lastUpdate?: string;
  link?: string;
  note?: string;
  tags?: string[];
  title?: string;
  type?: string;
};
