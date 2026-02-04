import { Router } from 'express';
import { ProductSetsController } from './product-sets.controller';

const router = Router();
const controller = new ProductSetsController();

router.get('/', (req, res, next) => controller.list(req, res, next));
router.get('/:id', (req, res, next) => controller.getById(req, res, next));

export default router;
