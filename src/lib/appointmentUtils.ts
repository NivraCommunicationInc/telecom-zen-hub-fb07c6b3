import { supabase } from "@/integrations/supabase/client";

// Service types that require installation appointments
const INSTALLATION_SERVICE_TYPES = ["internet", "tv_internet", "giga_tv", "tv", "Internet", "TV + Internet"];
const DELIVERY_ONLY_TYPES = ["mobile", "streaming", "accessories", "Mobile", "Streaming"];

export interface AppointmentData {
  orderId: string;
  orderNumber?: string;
  userId: string;
  clientEmail: string;
  clientPhone?: string;
  clientName?: string;
  serviceType: string;
  category?: string;
  serviceAddress: string;
  serviceCity?: string;
  servicePostalCode?: string;
  scheduledDate: string; // ISO string
  scheduledTime: string; // e.g. "08h00 - 10h00"
  installationMethod: "auto" | "technician";
  deliveryFee?: number;
  installationFee?: number;
  equipmentDetails?: any[];
  notes?: string;
}

export interface CreateAppointmentResult {
  success: boolean;
  appointment?: any;
  error?: string;
}

/**
 * Determines appointment type based on service/category
 */
export const getAppointmentType = (serviceType: string, category?: string): "installation" | "delivery" => {
  const lowerService = serviceType.toLowerCase();
  const lowerCategory = (category || "").toLowerCase();
  
  // Installation required for Internet and TV services
  if (
    lowerService.includes("internet") || 
    lowerService.includes("tv") ||
    lowerCategory.includes("internet") ||
    lowerCategory.includes("tv")
  ) {
    return "installation";
  }
  
  // Delivery only for mobile, streaming, accessories
  if (
    lowerService.includes("mobile") ||
    lowerService.includes("streaming") ||
    lowerService.includes("accessories") ||
    lowerCategory.includes("mobile") ||
    lowerCategory.includes("streaming")
  ) {
    return "delivery";
  }
  
  // Default to installation
  return "installation";
};

/**
 * Generates appointment title based on service type
 */
export const generateAppointmentTitle = (serviceType: string, installationMethod: "auto" | "technician"): string => {
  const type = getAppointmentType(serviceType);
  
  if (type === "delivery") {
    return `Livraison - ${serviceType}`;
  }
  
  if (installationMethod === "technician") {
    return `Installation Technicien - ${serviceType}`;
  }
  
  return `Auto-installation - ${serviceType}`;
};

/**
 * Parse time slot to get scheduled datetime
 */
export const parseScheduledDateTime = (dateStr: string, timeSlot: string): Date => {
  const date = new Date(dateStr);
  
  // Parse time slot like "08h00 - 10h00"
  const timeMatch = timeSlot.match(/(\d{2})h(\d{2})/);
  if (timeMatch) {
    date.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
  } else {
    // Default to 9 AM if parsing fails
    date.setHours(9, 0, 0, 0);
  }
  
  return date;
};

/**
 * Creates an appointment record in the database
 * Should be called after successful order creation
 */
export const createAppointmentFromOrder = async (data: AppointmentData): Promise<CreateAppointmentResult> => {
  try {
    // Validate required fields
    if (!data.userId) {
      return { success: false, error: "User ID is required" };
    }
    if (!data.scheduledDate || !data.scheduledTime) {
      return { success: false, error: "Scheduled date and time are required" };
    }
    
    const appointmentType = getAppointmentType(data.serviceType, data.category);
    const title = generateAppointmentTitle(data.serviceType, data.installationMethod);
    
    // Safe date parsing with validation
    let scheduledAt: Date;
    try {
      scheduledAt = parseScheduledDateTime(data.scheduledDate, data.scheduledTime);
      if (isNaN(scheduledAt.getTime())) {
        throw new Error("Invalid date");
      }
    } catch {
      return { success: false, error: "Invalid date/time format" };
    }
    
    // Calculate fees based on installation method
    const deliveryFee = data.installationMethod === "auto" ? (data.deliveryFee ?? 30) : 0;
    const installationFee = data.installationMethod === "technician" ? (data.installationFee ?? 50) : 0;
    
    const appointmentPayload = {
      order_id: data.orderId,
      client_id: data.userId,
      client_email: data.clientEmail || "",
      client_phone: data.clientPhone || null,
      title,
      description: `${appointmentType === "installation" ? "Installation" : "Livraison"} pour commande ${data.orderNumber || data.orderId}`,
      service_type: data.serviceType || "Internet",
      service_address: data.serviceAddress || "",
      service_city: data.serviceCity || null,
      service_postal_code: data.servicePostalCode || null,
      installation_method: data.installationMethod || "auto",
      scheduled_at: scheduledAt.toISOString(),
      delivery_fee: deliveryFee,
      installation_fee: installationFee,
      equipment_details: data.equipmentDetails || [],
      status: data.installationMethod === "technician" ? "scheduled" : "scheduled",
      created_by: data.userId,
    };

    console.log("Creating appointment with payload:", appointmentPayload);

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert(appointmentPayload)
      .select()
      .single();

    if (error) {
      console.error("Appointment creation error:", error);
      return { success: false, error: error.message };
    }

    if (!appointment) {
      return { success: false, error: "No appointment data returned" };
    }

    console.log("Appointment created successfully:", appointment.appointment_number, appointment.id);
    return { success: true, appointment };
  } catch (err: any) {
    console.error("Appointment creation exception:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
};

/**
 * Updates order with linked appointment ID
 */
export const linkAppointmentToOrder = async (orderId: string, appointmentDate: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("orders")
      .update({ appointment_date: appointmentDate })
      .eq("id", orderId);
    
    return !error;
  } catch {
    return false;
  }
};

/**
 * Check if appointment can be modified (24h+ before scheduled time)
 */
export const canModifyAppointment = (scheduledAt: string): { canModify: boolean; hoursRemaining: number } => {
  const scheduled = new Date(scheduledAt);
  const now = new Date();
  const hoursRemaining = (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  return {
    canModify: hoursRemaining >= 24,
    hoursRemaining: Math.round(hoursRemaining),
  };
};
