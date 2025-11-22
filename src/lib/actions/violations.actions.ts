"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Database } from "@/lib/database.types";
import { z } from "zod";

// تعريف نوع البيانات لسهولة الاستخدام
type Violation = Database["public"]["Tables"]["violations"]["Row"];
type ViolationInsert = Database["public"]["Tables"]["violations"]["Insert"];
type ViolationUpdate = Database["public"]["Tables"]["violations"]["Update"];

// تعريف مخطط البيانات (Schema) لجدول Violations باستخدام Zod
const ViolationSchema = z.object({
  vehicle_id: z.string().uuid("Invalid vehicle ID."),
  driver_id: z.string().uuid("Invalid driver ID.").optional().nullable(),
  violation_type: z.string().min(1, "Violation type is required."),
  violation_date: z.string().datetime("Invalid date format."),
  fine_amount: z.number().min(0, "Fine amount must be non-negative."),
  payment_status: z.enum(["paid", "unpaid", "disputed"]).default("unpaid"),
  notes: z.string().optional().nullable(),
  ticket_number: z.string().optional().nullable(),
  ticket_image_url: z.string().url("Invalid ticket image URL.").optional().nullable(),
});

// -----------------------------------------------------------------------------
// 1. CREATE (إضافة مخالفة جديدة)
// -----------------------------------------------------------------------------
export async function createViolation(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // استخراج البيانات من FormData
  const rawFormData = {
    vehicle_id: formData.get("vehicle_id"),
    driver_id: formData.get("driver_id") || null,
    violation_type: formData.get("violation_type"),
    violation_date: formData.get("violation_date"),
    fine_amount: Number(formData.get("fine_amount")),
    payment_status: formData.get("payment_status"),
    notes: formData.get("notes"),
    ticket_number: formData.get("ticket_number"),
    ticket_image_url: formData.get("ticket_image_url"),
  };

  // التحقق من صحة البيانات
  const validatedFields = ViolationSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Failed to create violation record due to validation errors.",
    };
  }

  const violationData: ViolationInsert = validatedFields.data;

  const { error } = await supabase
    .from("violations")
    .insert(violationData);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to create violation record. ${error.message}`,
    };
  }

  revalidatePath(`/app/[workspaceId]/vehicles/${violationData.vehicle_id}`);
  revalidatePath("/app/[workspaceId]/operations/violations");
  return { message: "Violation record created successfully." };
}

// -----------------------------------------------------------------------------
// 2. READ (جلب المخالفات)
// -----------------------------------------------------------------------------
export async function getViolations(workspaceId: string): Promise<{ data: Violation[] | null; error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "User not authenticated." };
  }

  // جلب المخالفات مع معلومات السيارة والسائق
  const { data, error } = await supabase
    .from("violations")
    .select("*, vehicles(plate_number, brand, model), workspace_members(user_profiles(full_name))")
    .order("violation_date", { ascending: false });

  // ملاحظة: RLS Policy على violations سيتولى فلترة البيانات حسب الـ workspace
  
  if (error) {
    console.error("Supabase Error:", error);
    return { data: null, error: `Database Error: Failed to fetch violation records. ${error.message}` };
  }

  return { data: data as Violation[], error: null };
}

// -----------------------------------------------------------------------------
// 3. UPDATE (تعديل مخالفة)
// -----------------------------------------------------------------------------
export async function updateViolation(violationId: string, formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // استخراج البيانات من FormData
  const rawFormData = {
    vehicle_id: formData.get("vehicle_id"),
    driver_id: formData.get("driver_id") || null,
    violation_type: formData.get("violation_type"),
    violation_date: formData.get("violation_date"),
    fine_amount: Number(formData.get("fine_amount")),
    payment_status: formData.get("payment_status"),
    notes: formData.get("notes"),
    ticket_number: formData.get("ticket_number"),
    ticket_image_url: formData.get("ticket_image_url"),
  };

  // التحقق من صحة البيانات (نستخدم Partial لعدم الحاجة لجميع الحقول)
  const validatedFields = ViolationSchema.partial().safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Failed to update violation record due to validation errors.",
    };
  }

  const violationData: ViolationUpdate = validatedFields.data;

  const { error } = await supabase
    .from("violations")
    .update(violationData)
    .eq("id", violationId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to update violation record. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/operations/violations");
  return { message: "Violation record updated successfully." };
}

// -----------------------------------------------------------------------------
// 4. DELETE (حذف مخالفة)
// -----------------------------------------------------------------------------
export async function deleteViolation(violationId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("violations")
    .delete()
    .eq("id", violationId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to delete violation record. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/operations/violations");
  return { message: "Violation record deleted successfully." };
}
