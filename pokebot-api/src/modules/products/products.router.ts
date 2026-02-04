import { Router } from 'express';
import { ProductsController } from './products.controller';

const router = Router();
const controller = new ProductsController();

router.get('/', (req, res, next) => controller.list(req, res, next));
router.get('/:id', (req, res, next) => controller.getById(req, res, next));
router.get('/:id/prices', (req, res, next) => controller.getPrices(req, res, next));

export default router;
