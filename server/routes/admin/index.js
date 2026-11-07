import { Router } from 'express';
import { requireAuth, verifyCsrf } from '../../middleware/auth.js';
import { articlesRouter } from './articles.js';
import { moderationRouter } from './moderation.js';
import { mediaRouter } from './media.js';
import { peopleRouter } from './people.js';
import { siteRouter } from './site.js';
import { systemRouter } from './system.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, verifyCsrf);
adminRouter.use(articlesRouter);
adminRouter.use(peopleRouter);
adminRouter.use(mediaRouter);
adminRouter.use(moderationRouter);
adminRouter.use(siteRouter);
adminRouter.use(systemRouter);
