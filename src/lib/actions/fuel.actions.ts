"use server";

import { createClient } from "@/lib/supabase/server-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Database } from "@/lib/database.types";
import { z } from "zod";

// تعريف نوع البيانات لسهولة الاستخدام
type FuelRecord = Database["public"]["Tables"]["fuel_records"]["Row"];
type FuelRecordInsert = Database["public"]["Tables"]["fuel_records"]["Insert"];
type FuelRecordUpdate = Database["public"]["Tables"]["fuel_records"]["Update"];

// تعريف مخطط البيانات (Schema) لجدول Fuel Records باستخدام Zod
const FuelRecordSchema = z.object({
  vehicle_id: z.string().uuid("Invalid vehicle ID."),
  driver_id: z.string().uuid("Invalid driver ID."),
  refuel_date: z.string().datetime("Invalid date format."),
  odometer_reading: z.number().int().min(0, "Odometer reading must be non-negative."),
  fuel_type: z.string().min(1, "Fuel type is required."),
  liters: z.number().min(0.01, "Liters must be greater than zero."),
  price_per_liter: z.number().min(0.01, "Price per liter must be greater than zero."),
  station_name: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  receipt_image_url: z.string().url("Invalid receipt image URL.").optional().nullable(),
  pump_reading_image_url: z.string().url("Invalid pump reading image URL.").optional().nullable(),
  odometer_image_url: z.string().url("Invalid odometer image URL.").optional().nullable(),
  notes: z.string().optional().nullable(),
  requires_approval: z.boolean().default(false),
  approval_status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

// -----------------------------------------------------------------------------
// 1. CREATE (إضافة سجل وقود جديد)
// -----------------------------------------------------------------------------
export async function createFuelRecord(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // استخراج البيانات من FormData
  const rawFormData = {
    vehicle_id: formData.get("vehicle_id"),
    driver_id: formData.get("driver_id"),
    refuel_date: formData.get("refuel_date"),
    odometer_reading: Number(formData.get("odometer_reading")),
    fuel_type: formData.get("fuel_type"),
    liters: Number(formData.get("liters")),
    price_per_liter: Number(formData.get("price_per_liter")),
    station_name: formData.get("station_name"),
    location: formData.get("location"),
    receipt_image_url: formData.get("receipt_image_url"),
    pump_reading_image_url: formData.get("pump_reading_image_url"),
    odometer_image_url: formData.get("odometer_image_url"),
    notes: formData.get("notes"),
    requires_approval: formData.get("requires_approval") === "on",
    approval_status: formData.get("approval_status"),
  };

  // التحقق من صحة البيانات
  const validatedFields = FuelRecordSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Failed to create fuel record due to validation errors.",
    };
  }

  const fuelData: FuelRecordInsert = validatedFields.data;

  const { error } = await supabase
    .from("fuel_records")
    .insert(fuelData);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to create fuel record. ${error.message}`,
    };
  }

  revalidatePath(`/app/[workspaceId]/vehicles/${fuelData.vehicle_id}`);
  revalidatePath("/app/[workspaceId]/operations/fuel");
  return { message: "Fuel record created successfully." };
}

// -----------------------------------------------------------------------------
// 2. READ (جلب سجلات الوقود)
// -----------------------------------------------------------------------------
export async function getFuelRecords(workspaceId: string): Promise<{ data: FuelRecord[] | null; error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "User not authenticated." };
  }

  // جلب سجلات الوقود مع معلومات السيارة والسائق
  const { data, error } = await supabase
    .from("fuel_records")
    .select("*, vehicles(plate_number, brand, model), workspace_members(user_profiles(full_name))")
    .order("refuel_date", { ascending: false });

  // ملاحظة: RLS Policy على fuel_records سيتولى فلترة البيانات حسب الـ workspace
  
  if (error) {
    console.error("Supabase Error:", error);
    return { data: null, error: `Database Error: Failed to fetch fuel records. ${error.message}` };
  }

  return { data: data as FuelRecord[], error: null };
}

// -----------------------------------------------------------------------------
// 3. UPDATE (تعديل سجل وقود)
// -----------------------------------------------------------------------------
export async function updateFuelRecord(recordId: string, formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // استخراج البيانات من FormData
  const rawFormData = {
    vehicle_id: formData.get("vehicle_id"),
    driver_id: formData.get("driver_id"),
    refuel_date: formData.get("refuel_date"),
    odometer_reading: Number(formData.get("odometer_reading")),
    fuel_type: formData.get("fuel_type"),
    liters: Number(formData.get("liters")),
    price_per_liter: Number(formData.get("price_per_liter")),
    station_name: formData.get("station_name"),
    location: formData.get("location"),
    receipt_image_url: formData.get("receipt_image_url"),
    pump_reading_image_url: formData.get("pump_reading_image_url"),
    odometer_image_url: formData.get("odometer_image_url"),
    notes: formData.get("notes"),
    requires_approval: formData.get("requires_approval") === "on",
    approval_status: formData.get("approval_status"),
    approved_by: formData.get("approved_by") || null,
    approved_at: formData.get("approved_at") || null,
  };

  // التحقق من صحة البيانات (نستخدم Partial لعدم الحاجة لجميع الحقول)
  const validatedFields = FuelRecordSchema.partial().safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Failed to update fuel record due to validation errors.",
    };
  }

  const fuelData: FuelRecordUpdate = validatedFields.data;

  const { error } = await supabase
    .from("fuel_records")
    .update(fuelData)
    .eq("id", recordId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to update fuel record. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/operations/fuel");
  return { message: "Fuel record updated successfully." };
}

// -----------------------------------------------------------------------------
// 4. DELETE (حذف سجل وقود)
// -----------------------------------------------------------------------------
export async function deleteFuelRecord(recordId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("fuel_records")
    .delete()
    .eq("id", recordId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to delete fuel record. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/operations/fuel");
  return { message: "Fuel record deleted successfully." };
}

// -----------------------------------------------------------------------------
// 5. APPROVAL (الموافقة على سجل وقود)
// -----------------------------------------------------------------------------
export async function approveFuelRecord(recordId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("fuel_records")
    .update({
      approval_status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", recordId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to approve fuel record. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/operations/fuel");
  return { message: "Fuel record approved successfully." };
}
