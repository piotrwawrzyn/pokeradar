import { Router } from 'express';
import { WatchlistController } from './watchlist.controller';
import { validate } from '../../shared/middleware';
import { addWatchEntrySchema, updateWatchEntrySchema } from './watchlist.validation';

const router = Router();
const controller = new WatchlistController();

router.get('/', (req, res, next) => controller.list(req, res, next));
router.post('/', validate(addWatchEntrySchema), (req, res, next) => controller.add(req, res, next));
router.patch('/:id', validate(updateWatchEntrySchema), (req, res, next) => controller.update(req, res, next));
router.delete('/:id', (req, res, next) => controller.remove(req, res, next));

export default router;
