"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Database } from "@/lib/database.types";
import { z } from "zod";

// تعريف نوع البيانات لسهولة الاستخدام
type MaintenanceRecord = Database["public"]["Tables"]["maintenance_records"]["Row"];
type MaintenanceRecordInsert = Database["public"]["Tables"]["maintenance_records"]["Insert"];
type MaintenanceRecordUpdate = Database["public"]["Tables"]["maintenance_records"]["Update"];

// تعريف مخطط البيانات (Schema) لجدول Maintenance Records باستخدام Zod
const MaintenanceRecordSchema = z.object({
  vehicle_id: z.string().uuid("Invalid vehicle ID."),
  maintenance_type: z.string().min(1, "Maintenance type is required."),
  service_provider: z.string().optional().nullable(),
  cost: z.number().min(0, "Cost must be non-negative."),
  odometer_reading: z.number().int().min(0, "Odometer reading must be non-negative."),
  service_date: z.string().datetime("Invalid date format."),
  notes: z.string().optional().nullable(),
  receipt_image_url: z.string().url("Invalid receipt image URL.").optional().nullable(),
  is_warranty: z.boolean().default(false),
  is_approved: z.boolean().default(false),
});

// -----------------------------------------------------------------------------
// 1. CREATE (إضافة سجل صيانة جديد)
// -----------------------------------------------------------------------------
export async function createMaintenanceRecord(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // استخراج البيانات من FormData
  const rawFormData = {
    vehicle_id: formData.get("vehicle_id"),
    maintenance_type: formData.get("maintenance_type"),
    service_provider: formData.get("service_provider"),
    cost: Number(formData.get("cost")),
    odometer_reading: Number(formData.get("odometer_reading")),
    service_date: formData.get("service_date"),
    notes: formData.get("notes"),
    receipt_image_url: formData.get("receipt_image_url"),
    is_warranty: formData.get("is_warranty") === "on",
    is_approved: formData.get("is_approved") === "on",
  };

  // التحقق من صحة البيانات
  const validatedFields = MaintenanceRecordSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Failed to create maintenance record due to validation errors.",
    };
  }

  const maintenanceData: MaintenanceRecordInsert = validatedFields.data;

  const { error } = await supabase
    .from("maintenance_records")
    .insert(maintenanceData);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to create maintenance record. ${error.message}`,
    };
  }

  revalidatePath(`/app/[workspaceId]/vehicles/${maintenanceData.vehicle_id}`);
  revalidatePath("/app/[workspaceId]/operations/maintenance");
  return { message: "Maintenance record created successfully." };
}

// -----------------------------------------------------------------------------
// 2. READ (جلب سجلات الصيانة)
// -----------------------------------------------------------------------------
export async function getMaintenanceRecords(workspaceId: string): Promise<{ data: MaintenanceRecord[] | null; error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "User not authenticated." };
  }

  // جلب سجلات الصيانة مع معلومات السيارة
  const { data, error } = await supabase
    .from("maintenance_records")
    .select("*, vehicles(plate_number, brand, model)")
    .order("service_date", { ascending: false });

  // ملاحظة: RLS Policy على maintenance_records سيتولى فلترة البيانات حسب الـ workspace
  
  if (error) {
    console.error("Supabase Error:", error);
    return { data: null, error: `Database Error: Failed to fetch maintenance records. ${error.message}` };
  }

  return { data: data as MaintenanceRecord[], error: null };
}

// -----------------------------------------------------------------------------
// 3. UPDATE (تعديل سجل صيانة)
// -----------------------------------------------------------------------------
export async function updateMaintenanceRecord(recordId: string, formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // استخراج البيانات من FormData
  const rawFormData = {
    vehicle_id: formData.get("vehicle_id"),
    maintenance_type: formData.get("maintenance_type"),
    service_provider: formData.get("service_provider"),
    cost: Number(formData.get("cost")),
    odometer_reading: Number(formData.get("odometer_reading")),
    service_date: formData.get("service_date"),
    notes: formData.get("notes"),
    receipt_image_url: formData.get("receipt_image_url"),
    is_warranty: formData.get("is_warranty") === "on",
    is_approved: formData.get("is_approved") === "on",
  };

  // التحقق من صحة البيانات (نستخدم Partial لعدم الحاجة لجميع الحقول)
  const validatedFields = MaintenanceRecordSchema.partial().safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Failed to update maintenance record due to validation errors.",
    };
  }

  const maintenanceData: MaintenanceRecordUpdate = validatedFields.data;

  const { error } = await supabase
    .from("maintenance_records")
    .update(maintenanceData)
    .eq("id", recordId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to update maintenance record. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/operations/maintenance");
  return { message: "Maintenance record updated successfully." };
}

// -----------------------------------------------------------------------------
// 4. DELETE (حذف سجل صيانة)
// -----------------------------------------------------------------------------
export async function deleteMaintenanceRecord(recordId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("maintenance_records")
    .delete()
    .eq("id", recordId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to delete maintenance record. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/operations/maintenance");
  return { message: "Maintenance record deleted successfully." };
}
