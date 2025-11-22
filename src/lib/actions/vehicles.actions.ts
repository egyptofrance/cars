"use server";

import { createClient } from "@/lib/supabase/server-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Database } from "@/lib/database.types";
import { z } from "zod";

// تعريف مخطط البيانات (Schema) لجدول Vehicles باستخدام Zod
// نستخدم نفس أنواع البيانات الموجودة في database.types.ts
const VehicleSchema = z.object({
  plate_number: z.string().min(1, "Plate number is required."),
  brand: z.string().min(1, "Brand is required."),
  model: z.string().min(1, "Model is required."),
  year: z.number().int().min(1900, "Invalid year.").max(new Date().getFullYear() + 1, "Invalid year."),
  color: z.string().optional(),
  vin: z.string().optional(),
  fuel_type: z.enum(["petrol", "diesel", "electric", "hybrid"], {
    required_error: "Fuel type is required.",
  }),
  transmission: z.enum(["manual", "automatic"]).optional(),
  engine_capacity: z.number().optional(),
  purchase_date: z.string().optional(),
  purchase_price: z.number().optional(),
  purchase_odometer: z.number().optional(),
  status: z.enum(["active", "maintenance", "inactive", "sold"]).default("active"),
  current_odometer: z.number().optional(),
  current_driver_id: z.string().uuid().optional().nullable(),
  registration_expiry: z.string().optional(),
  insurance_expiry: z.string().optional(),
  insurance_company: z.string().optional(),
  insurance_policy_number: z.string().optional(),
  notes: z.string().optional(),
  workspace_id: z.string().uuid(), // يجب أن يتم تمريره من الواجهة
});

// تعريف نوع البيانات لسهولة الاستخدام
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];
type VehicleUpdate = Database["public"]["Tables"]["vehicles"]["Update"];

// -----------------------------------------------------------------------------
// 1. CREATE (إضافة سيارة جديدة)
// -----------------------------------------------------------------------------
export async function createVehicle(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // استخراج البيانات من FormData
  const rawFormData = {
    plate_number: formData.get("plate_number"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    year: Number(formData.get("year")),
    color: formData.get("color"),
    vin: formData.get("vin"),
    fuel_type: formData.get("fuel_type"),
    transmission: formData.get("transmission"),
    engine_capacity: Number(formData.get("engine_capacity")),
    purchase_date: formData.get("purchase_date"),
    purchase_price: Number(formData.get("purchase_price")),
    purchase_odometer: Number(formData.get("purchase_odometer")),
    status: formData.get("status"),
    current_odometer: Number(formData.get("current_odometer")),
    current_driver_id: formData.get("current_driver_id") || null,
    registration_expiry: formData.get("registration_expiry"),
    insurance_expiry: formData.get("insurance_expiry"),
    insurance_company: formData.get("insurance_company"),
    insurance_policy_number: formData.get("insurance_policy_number"),
    notes: formData.get("notes"),
    workspace_id: formData.get("workspace_id"),
  };

  // التحقق من صحة البيانات
  const validatedFields = VehicleSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Failed to create vehicle due to validation errors.",
    };
  }

  const vehicleData: VehicleInsert = {
    ...validatedFields.data,
    created_by: user.id,
    // Supabase RLS و Triggers سيتولى التحقق من الصلاحيات والحدود
  };

  const { error } = await supabase
    .from("vehicles")
    .insert(vehicleData);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to create vehicle. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/vehicles");
  return { message: "Vehicle created successfully." };
}

// -----------------------------------------------------------------------------
// 2. READ (جلب السيارات)
// -----------------------------------------------------------------------------
export async function getVehicles(workspaceId: string): Promise<{ data: Vehicle[] | null; error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "User not authenticated." };
  }

  // RLS Policy على جدول vehicles سيتولى التأكد من أن المستخدم يرى سيارات الـ workspace الخاص به فقط
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase Error:", error);
    return { data: null, error: `Database Error: Failed to fetch vehicles. ${error.message}` };
  }

  return { data: data as Vehicle[], error: null };
}

export async function getVehicleById(vehicleId: string): Promise<{ data: Vehicle | null; error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "User not authenticated." };
  }

  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .single();

  if (error) {
    console.error("Supabase Error:", error);
    return { data: null, error: `Database Error: Failed to fetch vehicle. ${error.message}` };
  }

  return { data: data as Vehicle, error: null };
}

// -----------------------------------------------------------------------------
// 3. UPDATE (تعديل بيانات سيارة)
// -----------------------------------------------------------------------------
export async function updateVehicle(vehicleId: string, formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // استخراج البيانات من FormData
  const rawFormData = {
    plate_number: formData.get("plate_number"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    year: Number(formData.get("year")),
    color: formData.get("color"),
    vin: formData.get("vin"),
    fuel_type: formData.get("fuel_type"),
    transmission: formData.get("transmission"),
    engine_capacity: Number(formData.get("engine_capacity")),
    purchase_date: formData.get("purchase_date"),
    purchase_price: Number(formData.get("purchase_price")),
    purchase_odometer: Number(formData.get("purchase_odometer")),
    status: formData.get("status"),
    current_odometer: Number(formData.get("current_odometer")),
    current_driver_id: formData.get("current_driver_id") || null,
    registration_expiry: formData.get("registration_expiry"),
    insurance_expiry: formData.get("insurance_expiry"),
    insurance_company: formData.get("insurance_company"),
    insurance_policy_number: formData.get("insurance_policy_number"),
    notes: formData.get("notes"),
    workspace_id: formData.get("workspace_id"), // مطلوب للتحقق من الصلاحيات
  };

  // التحقق من صحة البيانات (نستخدم Partial لعدم الحاجة لجميع الحقول)
  const validatedFields = VehicleSchema.partial().safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Failed to update vehicle due to validation errors.",
    };
  }

  const vehicleData: VehicleUpdate = validatedFields.data;

  const { error } = await supabase
    .from("vehicles")
    .update(vehicleData)
    .eq("id", vehicleId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to update vehicle. ${error.message}`,
    };
  }

  revalidatePath(`/app/[workspaceId]/vehicles/${vehicleId}`);
  return { message: "Vehicle updated successfully." };
}

// -----------------------------------------------------------------------------
// 4. DELETE (حذف سيارة)
// -----------------------------------------------------------------------------
export async function deleteVehicle(vehicleId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS Policy على جدول vehicles سيتولى التأكد من أن المستخدم لديه صلاحية الحذف (Owner)
  const { error } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", vehicleId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to delete vehicle. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/vehicles");
  return { message: "Vehicle deleted successfully." };
}
