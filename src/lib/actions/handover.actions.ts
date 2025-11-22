"use server";

import { createClient } from "@/lib/supabase/server-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Database } from "@/lib/database.types";
import { z } from "zod";

// تعريف نوع البيانات لسهولة الاستخدام
type HandoverRecord = Database["public"]["Tables"]["vehicle_handover_records"]["Row"];
type HandoverRecordInsert = Database["public"]["Tables"]["vehicle_handover_records"]["Insert"];
type HandoverRecordUpdate = Database["public"]["Tables"]["vehicle_handover_records"]["Update"];

// تعريف مخطط البيانات (Schema) لجدول Vehicle Handover Records باستخدام Zod
const HandoverRecordSchema = z.object({
  vehicle_id: z.string().uuid("Invalid vehicle ID."),
  from_driver_id: z.string().uuid("Invalid from driver ID.").optional().nullable(),
  to_driver_id: z.string().uuid("Invalid to driver ID."),
  handover_date: z.string().datetime("Invalid handover date format."),
  handover_odometer: z.number().int().min(0, "Odometer reading must be non-negative."),
  handover_notes: z.string().optional().nullable(),
  handover_condition: z.enum(["excellent", "good", "fair", "poor"]).default("good"),
  is_confirmed: z.boolean().default(false),
  confirmation_date: z.string().datetime("Invalid confirmation date format.").optional().nullable(),
});

// -----------------------------------------------------------------------------
// 1. CREATE (تسجيل عملية تسليم جديدة)
// -----------------------------------------------------------------------------
export async function createHandoverRecord(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // استخراج البيانات من FormData
  const rawFormData = {
    vehicle_id: formData.get("vehicle_id"),
    from_driver_id: formData.get("from_driver_id") || null,
    to_driver_id: formData.get("to_driver_id"),
    handover_date: formData.get("handover_date"),
    handover_odometer: Number(formData.get("handover_odometer")),
    handover_notes: formData.get("handover_notes"),
    handover_condition: formData.get("handover_condition"),
    is_confirmed: formData.get("is_confirmed") === "on",
    confirmation_date: formData.get("confirmation_date") || null,
  };

  // التحقق من صحة البيانات
  const validatedFields = HandoverRecordSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Failed to create handover record due to validation errors.",
    };
  }

  const handoverData: HandoverRecordInsert = validatedFields.data;

  const { error } = await supabase
    .from("vehicle_handover_records")
    .insert(handoverData);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to create handover record. ${error.message}`,
    };
  }

  revalidatePath(`/app/[workspaceId]/vehicles/${handoverData.vehicle_id}`);
  revalidatePath("/app/[workspaceId]/operations/handover");
  return { message: "Handover record created successfully." };
}

// -----------------------------------------------------------------------------
// 2. READ (جلب سجلات التسليم)
// -----------------------------------------------------------------------------
export async function getHandoverRecords(workspaceId: string): Promise<{ data: HandoverRecord[] | null; error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "User not authenticated." };
  }

  // جلب سجلات التسليم مع معلومات السيارة والسائقين
  const { data, error } = await supabase
    .from("vehicle_handover_records")
    .select("*, vehicles(plate_number, brand, model), from_driver:workspace_members!from_driver_id(user_profiles(full_name)), to_driver:workspace_members!to_driver_id(user_profiles(full_name))")
    .order("handover_date", { ascending: false });

  // ملاحظة: RLS Policy على vehicle_handover_records سيتولى فلترة البيانات حسب الـ workspace
  
  if (error) {
    console.error("Supabase Error:", error);
    return { data: null, error: `Database Error: Failed to fetch handover records. ${error.message}` };
  }

  return { data: data as HandoverRecord[], error: null };
}

// -----------------------------------------------------------------------------
// 3. UPDATE (تأكيد عملية التسليم)
// -----------------------------------------------------------------------------
export async function confirmHandover(recordId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("vehicle_handover_records")
    .update({
      is_confirmed: true,
      confirmation_date: new Date().toISOString(),
    })
    .eq("id", recordId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to confirm handover. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/operations/handover");
  return { message: "Handover confirmed successfully." };
}

// -----------------------------------------------------------------------------
// 4. DELETE (حذف سجل تسليم)
// -----------------------------------------------------------------------------
export async function deleteHandoverRecord(recordId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("vehicle_handover_records")
    .delete()
    .eq("id", recordId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to delete handover record. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/operations/handover");
  return { message: "Handover record deleted successfully." };
}
