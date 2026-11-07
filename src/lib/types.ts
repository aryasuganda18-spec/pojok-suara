export type ArticleType = 'berita' | 'opini' | 'kritik' | 'artikel';
export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';
export type Role = 'super_admin' | 'editor' | 'penulis' | 'kontributor';

export interface ImageObj {
  id: string;
  url: string;
  thumb: string;
  medium: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface AuthorRef {
  id: string | null;
  name: string;
  username: string | null;
  avatar: string | null;
}

export interface ArticleCard {
  id: string;
  type: ArticleType;
  slug: string;
  url: string;
  title: string;
  subtitle: string;
  excerpt: string;
  image: ImageObj | null;
  category: CategoryRef | null;
  author: AuthorRef | null;
  tags: string[];
  published_at: string;
  reading_time: number;
  views: number;
  likes: number;
  comments: number;
}

export interface PublicAuthor {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar: ImageObj | null;
  social: Record<string, string>;
  fields: string[];
  email: string;
  joined_at: string;
  article_count: number;
}

export interface ArticleDetail extends ArticleCard {
  content_html: string;
  featured_image: ImageObj | null;
  comments_enabled: boolean;
  updated_at: string;
  status: ArticleStatus;
  scheduled: boolean;
  author_profile: PublicAuthor | null;
  related: ArticleCard[];
  previous: { title: string; url: string } | null;
  next: { title: string; url: string } | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface SiteInfo {
  site_name: string;
  tagline: string;
  description: string;
  logo: { url: string; thumb: string; width: number | null; height: number | null } | null;
  favicon: string | null;
  theme: { accent: string; default_mode: 'light' | 'dark' | 'system' };
  nav: NavLink[];
  footer: { about: string; copyright: string; links: NavLink[] };
  social: Record<string, string>;
  email_redaksi: string;
  per_page: number;
  breaking: { text: string; url: string } | null;
  comments_enabled: boolean;
  newsletter_enabled: boolean;
  submissions_enabled: boolean;
  categories: { id: string; name: string; slug: string; description: string }[];
}

export interface HomeData {
  hero: ArticleCard | null;
  latest: ArticleCard[];
  news: ArticleCard[];
  opinions: ArticleCard[];
  criticisms: ArticleCard[];
  editorial: ArticleCard[];
  picks: ArticleCard[];
  popular: ArticleCard[];
  authors: PublicAuthor[];
  total_published: number;
}

export interface CommentNode {
  id: string;
  name: string;
  body: string;
  created_at: string;
  replies: CommentNode[];
}

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: Role;
  role_label: string;
  author_id: string | null;
  must_change_password: boolean;
  permissions: string[];
}

export interface Suggestion {
  kind: string;
  title: string;
  hint: string;
  url: string;
}
