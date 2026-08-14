const express = require("express");

const MainControllers = require("../controllers/main.controllers.js");
const AuthControllers = require("../controllers/auth.controllers.js");
const CourseControllers = require("../controllers/course.controllers.js");
const AdminControllers = require("../controllers/admin.controllers.js");
const WatchControllers = require("../controllers/watch.controllers.js");
const StreamControllers = require("../controllers/stream.controllers.js");
const UploadControllers = require("../controllers/upload.controllers.js");

const validator = require("../utils/validator.js");
const protectRoute = require("../utils/jwt.js");
const { upload } = require("../utils/storageEngine.js");

const router = express.Router();

router.get("/", protectRoute.checkAuth, MainControllers.homeGET);
router.get("/courses", protectRoute.checkAuth, CourseControllers.courseShopGET);
router.get(
  "/course/:courseId",
  protectRoute.checkAuth,
  CourseControllers.courseGET,
);

router.get("/signup", protectRoute.isNotAuth, AuthControllers.signupGET);
router.post(
  "/signup",
  protectRoute.isNotAuth,
  validator.signupValidator,
  AuthControllers.signupPOST,
);

router.get("/verify/:id/:otp", AuthControllers.verify);
router.post("/verify/:id", AuthControllers.newVerify);

router.get("/login", protectRoute.isNotAuth, AuthControllers.loginGET);
router.post(
  "/login",
  protectRoute.isNotAuth,
  validator.loginValidator,
  AuthControllers.loginPOST,
);

router.get("/logout", AuthControllers.logout);

router.get("/forgot-password", AuthControllers.forgotPasswordGET);
router.post(
  "/forgot-password",
  validator.forgotPasswordValidator,
  AuthControllers.forgotPasswordPOST,
);

router.get("/reset-password/:email/:otp", AuthControllers.resetPasswordGET);
router.post(
  "/reset-password/:email/:otp",
  validator.resetPasswordValidator,
  AuthControllers.resetPasswordPOST,
);

router.get("/profile", protectRoute.isAuth, MainControllers.userProfileGET);

router.get(
  "/payment/:courseId",
  protectRoute.isAuth,
  CourseControllers.coursePayment,
);

router.get("/watch/:courseId", protectRoute.isAuth, WatchControllers.watchGET);
router.get(
  "/watch/:courseId/:videoId",
  protectRoute.isAuth,
  WatchControllers.watchGET,
);

router.get(
  "/stream/:videoId/master.m3u8",
  protectRoute.isAuthApi,
  StreamControllers.masterPlaylistGET,
);
router.get(
  "/stream/:videoId/:quality/playlist.m3u8",
  protectRoute.isAuthApi,
  StreamControllers.qualityPlaylistGET,
);
router.get(
  "/stream/:videoId/:quality/:segment",
  protectRoute.isAuthApi,
  StreamControllers.segmentGET,
);
router.get(
  "/stream/:videoId/key",
  protectRoute.isAuthApi,
  StreamControllers.keyGET,
);

const adminGuard = [protectRoute.isAuth, protectRoute.checkAdmin];
const adminGuardApi = [protectRoute.isAuthApi, protectRoute.checkAdminApi];

router.post(
  "/admin/videos/upload-urls",
  ...adminGuardApi,
  UploadControllers.getUploadUrlsPOST,
);

router.get("/dashboard", ...adminGuard, AdminControllers.dashboardGET);
router.post("/dashboard", ...adminGuard, AdminControllers.dashboardPOST);

router.get("/admin/add-course", ...adminGuard, AdminControllers.addCourseGET);
router.post(
  "/admin/add-course",
  ...adminGuard,
  upload.single("thumbnail"),
  validator.addCourseValidator,
  AdminControllers.addCoursePOST,
);

router.get("/admin/courses", ...adminGuard, AdminControllers.manageCoursesGET);
router.post(
  "/admin/courses/:courseId/delete",
  ...adminGuard,
  AdminControllers.deleteCoursePOST,
);

router.get(
  "/manage/:courseId",
  ...adminGuard,
  CourseControllers.courseManageGET,
);
router.post(
  "/manage/:courseId/add-video",
  ...adminGuard,
  validator.addVideoValidator,
  CourseControllers.courseManagePOST,
);
router.post(
  "/manage/:courseId/add-chapter",
  ...adminGuard,
  CourseControllers.addChapterPOST,
);
router.post(
  "/manage/:courseId/delete-video/:chapterId/:videoId",
  ...adminGuard,
  CourseControllers.deleteVideoPOST,
);

router.get(
  "/admin/manage/:userId",
  ...adminGuard,
  AdminControllers.userManageGET,
);
router.post(
  "/admin/manage/:userId",
  ...adminGuard,
  AdminControllers.userManagePOST,
);

router.get("/offline", MainControllers.offlineGET);

module.exports = router;
