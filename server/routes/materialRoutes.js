const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const materialController = require("../controllers/materialController");
const authMiddleware = require("../middleware/authMiddleware");
const quotaMiddleware = require("../middleware/quotaMiddleware");

// ✅ UPLOAD MATERIAL
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  quotaMiddleware.checkMaterialsQuota,
  materialController.uploadMaterial
);

// ✅ GET ALL MATERIALS FOR A COURSE
router.get(
  "/course/:courseId",
  authMiddleware,
  materialController.getCourseMaterials
);

router.get(
  "/",
  authMiddleware,
  materialController.getCourseMaterials
);

// ✅ GET MATERIALS FOR A WEEK
router.get(
  "/week/:weekId",
  authMiddleware,
  materialController.getWeekMaterials
);

// ✅ GET MATERIAL BY ID
router.get(
  "/:id",
  authMiddleware,
  materialController.getMaterialById
);

// ✅ DELETE MATERIAL
router.delete(
  "/:id",
  authMiddleware,
  materialController.deleteMaterial
);

module.exports = router;
