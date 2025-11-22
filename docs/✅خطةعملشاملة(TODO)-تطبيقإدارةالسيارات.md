# ✅ خطة عمل شاملة (TODO) - تطبيق إدارة السيارات

هذه خطة عمل مفصلة لتحويل Nextbase Template إلى تطبيق احترافي لإدارة السيارات والأساطيل.

---

## 🚀 المرحلة 1: إعداد قاعدة البيانات (Backend - Supabase)

- [x] **1.1 إنشاء الجداول الجديدة:**
  - [ ] `vehicles`
  - [ ] `vehicle_images`
  - [ ] `vehicle_handover_records`
  - [ ] `fuel_records`
  - [ ] `maintenance_records`
  - [ ] `trips`
  - [ ] `violations`
  - [ ] `maintenance_reminders`
  - [ ] `workspace_subscription_limits`

- [x] **1.2 إنشاء RLS Policies:**
  - [ ] تطبيق سياسات الأمان (RLS) على جميع الجداول الجديدة لضمان عزل البيانات بين Workspaces.

- [x] **1.3 إنشاء الدوال المساعدة (Functions):**
  - [ ] `calculate_cost_per_km()`
  - [ ] `calculate_fuel_efficiency()`
  - [ ] `get_vehicle_statistics()`

- [x] **1.4 إنشاء المحفزات (Triggers):**
  - [ ] `enforce_vehicle_limit` - للتحقق من حد السيارات قبل الإضافة.
  - [ ] `enforce_driver_limit` - للتحقق من حد السائقين قبل الإضافة.
  - [ ] `update_current_odometer` - لتحديث عداد السيارة تلقائياً بعد كل رحلة أو تسجيل وقود.
  - [ ] `update_vehicle_status_on_handover` - لتحديث حالة السيارة عند تسليمها.

- [x] **1.5 تحديث `database.types.ts`:**
  - [ ] تشغيل `npx supabase gen types typescript` لتحديث تعريفات TypeScript بعد إنشاء الجداول.

---

## 💻 المرحلة 2: تطوير الواجهة الخلفية (Backend - Next.js)

- [x] **2.1 Server Actions (CRUD):**
  - [x] إنشاء Server Actions لإدارة `vehicles` (إضافة، تعديل، حذف).
  - [x] إنشاء Server Actions لإدارة `fuel_records`.
  - [x] إنشاء Server Actions لإدارة `maintenance_records`.
  - [x] إنشاء Server Actions لإدارة `trips`.
  - [x] إنشاء Server Actions لإدارة `violations`.
  - [x] إنشاء Server Actions لإدارة `vehicle_handover_records`.

- [ ] **2.2 منطق الاشتراكات:**
  - [ ] تعديل Server Actions للتحقق من حدود الاشتراك (`workspace_subscription_limits`) قبل تنفيذ أي عملية إضافة (سيارة، سائق).
  - [ ] إنشاء دالة `checkFeatureFlag(workspaceId, featureName)` للتحقق من الميزات المتاحة للخطة.

- [ ] **2.3 تكامل Stripe:**
  - [ ] إنشاء Stripe Products & Prices في Stripe Dashboard.
  - [ ] إنشاء API Route (`/api/stripe/checkout-session`) لإنشاء جلسة دفع.
  - [ ] تعديل Webhook Handler (`/api/stripe/webhooks`) لتحديث `billing_subscriptions` و `workspace_subscription_limits` بعد نجاح الاشتراك.

- [ ] **2.4 إعدادات أولية عند إنشاء Workspace:**
  - [ ] تعديل دالة إنشاء Workspace لإضافة سجل تلقائي في `workspace_subscription_limits` للخطة المجانية (Free Plan).

---

## 🎨 المرحلة 3: تطوير الواجهة الأمامية (Frontend - UI/UX)

- [ ] **3.1 تنظيف القالب:**
  - [ ] حذف نظام `Projects` من الواجهة (صفحات، مكونات، روابط).
  - [ ] حذف أي مكونات أو صفحات غير مستخدمة.

- [ ] **3.2 تحديث التنقل (Navigation):**
  - [ ] تعديل الشريط الجانبي (Sidebar) ليشمل:
    - Dashboard
    - Vehicles
    - Drivers (Members)
    - Operations (Fuel, Maintenance, Trips)
    - Violations
    - Reports
    - Settings

- [ ] **3.3 لوحة التحكم (Dashboard):**
  - [ ] تصميم لوحة تحكم جديدة تعرض:
    - إحصائيات سريعة (عدد السيارات، السائقين، التكلفة الإجمالية).
    - قائمة بالسيارات وحالتها الحالية.
    - آخر 5 عمليات (وقود، صيانة).
    - تذكيرات الصيانة القادمة.

- [ ] **3.4 صفحة السيارات (Vehicles):**
  - [ ] إنشاء صفحة `/app/vehicles` لعرض جميع السيارات في جدول.
  - [ ] إنشاء زر "Add Vehicle" يفتح Dialog لإضافة سيارة جديدة.
  - [ ] إنشاء صفحة تفاصيل السيارة `/app/vehicles/[id]` تعرض:
    - المعلومات الأساسية.
    - معرض صور السيارة.
    - السجل التاريخي (تسليم، وقود، صيانة).
    - السائق الحالي.

- [ ] **3.5 صفحة السائقين (Drivers):**
  - [ ] الاستفادة من صفحة `workspace_members` الحالية.
  - [ ] تعديل واجهة دعوة الأعضاء لتشمل دور "Driver".

- [ ] **3.6 صفحة تسليم السيارة (Handover):**
  - [ ] إنشاء صفحة `/app/vehicles/[id]/handover`.
  - [ ] تصميم واجهة لتسجيل عملية التسليم:
    - اختيار السائق الجديد.
    - إدخال قراءة العداد.
    - رفع صور للسيارة (4 جهات + أي أضرار).
    - حقل توقيع للسائق (باستخدام مكتبة مثل `react-signature-canvas`).
    - زر تأكيد للسائق.

- [ ] **3.7 صفحات العمليات (Operations):**
  - [ ] إنشاء صفحات منفصلة لإدارة `fuel_records`, `maintenance_records`, `trips` مع جداول ونماذج إضافة/تعديل.

- [ ] **3.8 صفحة الاشتراكات والفوترة:**
  - [ ] إنشاء صفحة الأسعار `/pricing`.
  - [ ] ربط أزرار الاشتراك بجلسة Stripe Checkout.
  - [ ] إنشاء صفحة لإدارة الفوترة `/app/settings/billing` تستخدم Stripe Customer Portal.
  - [ ] تصميم Dialog "Upgrade Plan" يظهر عند الوصول للحد الأقصى.

- [ ] **3.9 صفحة التقارير (Reports):**
  - [ ] إنشاء صفحة `/app/reports`.
  - [ ] تصميم واجهة لعرض التقارير:
    - تكلفة الكيلومتر.
    - كفاءة استهلاك الوقود.
    - مقارنة أداء السيارات.
  - [ ] إضافة فلاتر (حسب التاريخ، حسب السيارة).

---

## ⚙️ المرحلة 4: اللمسات النهائية والاختبار

- [ ] **4.1 الترجمة (Localization):**
  - [ ] إضافة جميع النصوص الجديدة إلى ملفات الترجمة (`en.json`, `ar.json`).

- [ ] **4.2 اختبار شامل:**
  - [ ] اختبار جميع وظائف CRUD.
  - [ ] اختبار نظام الصلاحيات (تسجيل الدخول كـ Admin, Member, Driver).
  - [ ] اختبار نظام الاشتراكات (الترقية، الوصول للحدود).
  - [ ] اختبار عملية تسليم السيارة بالكامل.

- [ ] **4.3 النشر النهائي:**
  - [ ] دفع جميع التغييرات إلى GitHub.
  - [ ] التأكد من نجاح النشر على Vercel.

---

هذه الخطة شاملة وتغطي جميع جوانب المشروع. يمكننا البدء في تنفيذها خطوة بخطوة.
