import { Router } from 'express';
import { validate, imageUpload } from '../../shared/middleware';
import { AdminShopsController } from './admin-shops.controller';
import { AdminProductsController } from './admin-products.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminNotificationsController } from './admin-notifications.controller';
import {
  createProductSchema,
  updateProductSchema,
  createProductSetSchema,
  updateProductSetSchema,
  createProductTypeSchema,
  updateProductTypeSchema,
} from './admin.validation';

const router = Router();
const shopsCtrl = new AdminShopsController();
const productsCtrl = new AdminProductsController();
const usersCtrl = new AdminUsersController();
const notificationsCtrl = new AdminNotificationsController();

// Shop monitoring
router.get('/shops', (req, res, next) => shopsCtrl.list(req, res, next));
router.get('/shops/:shopId', (req, res, next) => shopsCtrl.getById(req, res, next));

// WatchlistProducts CRUD
router.get('/products', (req, res, next) => productsCtrl.list(req, res, next));
router.post('/products/upload-image', imageUpload.single('image'), (req, res, next) =>
  productsCtrl.uploadImageOnly(req, res, next),
);
router.post('/products', validate(createProductSchema), (req, res, next) =>
  productsCtrl.create(req, res, next),
);
router.patch('/products/:id', validate(updateProductSchema), (req, res, next) =>
  productsCtrl.update(req, res, next),
);
router.delete('/products/:id', (req, res, next) => productsCtrl.remove(req, res, next));
router.post('/products/:id/image', imageUpload.single('image'), (req, res, next) =>
  productsCtrl.uploadImage(req, res, next),
);

// ProductSets CRUD
router.get('/product-sets', (req, res, next) => productsCtrl.listSets(req, res, next));
router.post('/product-sets/upload-image', imageUpload.single('image'), (req, res, next) =>
  productsCtrl.uploadSetImageOnly(req, res, next),
);
router.post('/product-sets', validate(createProductSetSchema), (req, res, next) =>
  productsCtrl.createSet(req, res, next),
);
router.patch('/product-sets/:id', validate(updateProductSetSchema), (req, res, next) =>
  productsCtrl.updateSet(req, res, next),
);
router.delete('/product-sets/:id', (req, res, next) => productsCtrl.removeSet(req, res, next));
router.post('/product-sets/:id/image', imageUpload.single('image'), (req, res, next) =>
  productsCtrl.uploadSetImage(req, res, next),
);

// ProductTypes CRUD
router.get('/product-types', (req, res, next) => productsCtrl.listTypes(req, res, next));
router.post('/product-types', validate(createProductTypeSchema), (req, res, next) =>
  productsCtrl.createType(req, res, next),
);
router.patch('/product-types/:id', validate(updateProductTypeSchema), (req, res, next) =>
  productsCtrl.updateType(req, res, next),
);
router.delete('/product-types/:id', (req, res, next) => productsCtrl.removeType(req, res, next));

// Users
router.get('/users', (req, res, next) => usersCtrl.search(req, res, next));
router.get('/users/:clerkId', (req, res, next) => usersCtrl.getById(req, res, next));

// Notifications
router.get('/notifications', (req, res, next) => notificationsCtrl.list(req, res, next));

export default router;
