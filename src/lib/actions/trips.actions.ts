"use server";

import { createClient } from "@/lib/supabase/server-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Database } from "@/lib/database.types";
import { z } from "zod";

// تعريف نوع البيانات لسهولة الاستخدام
type Trip = Database["public"]["Tables"]["trips"]["Row"];
type TripInsert = Database["public"]["Tables"]["trips"]["Insert"];
type TripUpdate = Database["public"]["Tables"]["trips"]["Update"];

// تعريف مخطط البيانات (Schema) لجدول Trips باستخدام Zod
const TripSchema = z.object({
  vehicle_id: z.string().uuid("Invalid vehicle ID."),
  driver_id: z.string().uuid("Invalid driver ID."),
  start_time: z.string().datetime("Invalid start time format."),
  end_time: z.string().datetime("Invalid end time format.").optional().nullable(),
  start_odometer: z.number().int().min(0, "Start odometer must be non-negative."),
  end_odometer: z.number().int().min(0, "End odometer must be non-negative.").optional().nullable(),
  start_location: z.string().min(1, "Start location is required."),
  end_location: z.string().optional().nullable(),
  purpose: z.string().min(1, "Purpose is required."),
  notes: z.string().optional().nullable(),
  status: z.enum(["active", "completed", "cancelled"]).default("active"),
});

// -----------------------------------------------------------------------------
// 1. CREATE (بدء رحلة جديدة)
// -----------------------------------------------------------------------------
export async function startTrip(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // استخراج البيانات من FormData
  const rawFormData = {
    vehicle_id: formData.get("vehicle_id"),
    driver_id: formData.get("driver_id"),
    start_time: formData.get("start_time"),
    start_odometer: Number(formData.get("start_odometer")),
    start_location: formData.get("start_location"),
    purpose: formData.get("purpose"),
    notes: formData.get("notes"),
  };

  // التحقق من صحة البيانات (نستخدم فقط الحقول المطلوبة للبدء)
  const validatedFields = TripSchema.pick({
    vehicle_id: true,
    driver_id: true,
    start_time: true,
    start_odometer: true,
    start_location: true,
    purpose: true,
    notes: true,
  }).safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Failed to start trip due to validation errors.",
    };
  }

  const tripData: TripInsert = validatedFields.data;

  const { error } = await supabase
    .from("trips")
    .insert(tripData);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to start trip. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/operations/trips");
  return { message: "Trip started successfully." };
}

// -----------------------------------------------------------------------------
// 2. READ (جلب الرحلات)
// -----------------------------------------------------------------------------
export async function getTrips(workspaceId: string): Promise<{ data: Trip[] | null; error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "User not authenticated." };
  }

  // جلب الرحلات مع معلومات السيارة والسائق
  const { data, error } = await supabase
    .from("trips")
    .select("*, vehicles(plate_number, brand, model), workspace_members(user_profiles(full_name))")
    .order("start_time", { ascending: false });

  // ملاحظة: RLS Policy على trips سيتولى فلترة البيانات حسب الـ workspace
  
  if (error) {
    console.error("Supabase Error:", error);
    return { data: null, error: `Database Error: Failed to fetch trips. ${error.message}` };
  }

  return { data: data as Trip[], error: null };
}

// -----------------------------------------------------------------------------
// 3. UPDATE (إنهاء رحلة)
// -----------------------------------------------------------------------------
export async function endTrip(tripId: string, formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // استخراج البيانات من FormData
  const rawFormData = {
    end_time: formData.get("end_time"),
    end_odometer: Number(formData.get("end_odometer")),
    end_location: formData.get("end_location"),
    status: "completed",
  };

  // التحقق من صحة البيانات (نستخدم فقط الحقول المطلوبة للإنهاء)
  const validatedFields = TripSchema.pick({
    end_time: true,
    end_odometer: true,
    end_location: true,
    status: true,
  }).safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Failed to end trip due to validation errors.",
    };
  }

  const tripData: TripUpdate = validatedFields.data;

  const { error } = await supabase
    .from("trips")
    .update(tripData)
    .eq("id", tripId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to end trip. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/operations/trips");
  return { message: "Trip ended successfully." };
}

// -----------------------------------------------------------------------------
// 4. DELETE (حذف رحلة)
// -----------------------------------------------------------------------------
export async function deleteTrip(tripId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId);

  if (error) {
    console.error("Supabase Error:", error);
    return {
      message: `Database Error: Failed to delete trip. ${error.message}`,
    };
  }

  revalidatePath("/app/[workspaceId]/operations/trips");
  return { message: "Trip deleted successfully." };
}
