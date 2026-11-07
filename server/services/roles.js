export const ROLES = ['super_admin', 'editor', 'penulis', 'kontributor'];

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  editor: 'Editor',
  penulis: 'Penulis',
  kontributor: 'Kontributor',
};

const STAFF = ['super_admin', 'editor'];

/** Peta izin. Semua pemeriksaan hak akses dilakukan di backend lewat peta ini. */
const PERMISSIONS = {
  'articles:publish': STAFF,
  'articles:manage_all': STAFF,
  'articles:feature': STAFF,
  'categories:manage': STAFF,
  'comments:moderate': STAFF,
  'newsletter:manage': STAFF,
  'pages:manage': STAFF,
  'authors:manage_all': STAFF,
  'media:manage_all': STAFF,
  'stats:view_all': STAFF,
  'users:manage': ['super_admin'],
  'settings:manage': ['super_admin'],
  'backup:manage': ['super_admin'],
  'logs:view': ['super_admin'],
  'demo:clear': ['super_admin'],
};

export function can(user, permission) {
  if (!user) return false;
  return (PERMISSIONS[permission] ?? []).includes(user.role);
}

export const isStaff = (user) => STAFF.includes(user?.role);

/** Daftar izin milik pengguna, dikirim ke frontend hanya untuk mengatur tampilan menu (bukan sebagai pengaman). */
export const permissionsFor = (user) => Object.keys(PERMISSIONS).filter((permission) => can(user, permission));
