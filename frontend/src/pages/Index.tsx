import { useState } from "react";
import { Calendar, Mail, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { appointmentsApi } from "@/lib/api";

const Index = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    dateTime: "",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get minimum date-time (next hour)
  const getMinimumDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16);
  };

  // Validate appointment date is in the future
  const isValidAppointmentDate = (dateTimeString: string) => {
    const selectedDate = new Date(dateTimeString);
    const now = new Date();
    return selectedDate > now;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.fullName.trim()) {
      toast.error("Name is required");
      return;
    }
    
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }
    
    if (!formData.dateTime) {
      toast.error("Please select a date and time");
      return;
    }
    
    // Validate appointment date is in the future
    if (!isValidAppointmentDate(formData.dateTime)) {
      toast.error("Please select a future date and time (at least 1 hour from now)");
      return;
    }
    
    setIsSubmitting(true);

    try {
      // Map frontend fields to backend format
      const appointmentData = {
        name: formData.fullName, // Map fullName to name
        email: formData.email,
        appointmentDateTime: formData.dateTime, // Map dateTime to appointmentDateTime
        notes: formData.notes || undefined,
      };

      await appointmentsApi.create(appointmentData);
      
      toast.success("Appointment booked successfully!", {
        description: "You'll receive a confirmation email shortly.",
      });
      
      // Reset form
      setFormData({ fullName: "", email: "", dateTime: "", notes: "" });
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to book appointment. Please try again.";
      toast.error("Booking failed", {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">PAXFORM</h1>
          <Link to="/admin/login">
            <Button variant="outline" size="sm">
              Admin Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="gradient-hero py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Book Your Appointment
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Schedule a meeting with us easily and efficiently. Your appointment will be automatically synced with our calendar.
          </p>
        </div>
      </section>

      {/* Booking Form Section */}
      <section className="py-16 px-4 flex-1">
        <div className="container mx-auto max-w-3xl">
          <Card className="shadow-medium border-border/50">
            <CardContent className="pt-8 pb-8">
              <div className="mb-8">
                <h3 className="text-2xl font-semibold mb-2">Book an Appointment</h3>
                <p className="text-muted-foreground">
                  Fill out the form below to schedule your appointment. We'll send you a confirmation via email.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="text-sm font-medium text-foreground">
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    placeholder="John Doe"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email Address <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="john@example.com"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="dateTime" className="text-sm font-medium text-foreground">
                    Preferred Date & Time <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="dateTime"
                    name="dateTime"
                    type="datetime-local"
                    value={formData.dateTime}
                    onChange={handleChange}
                    min={getMinimumDateTime()}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="notes" className="text-sm font-medium text-foreground">
                    Notes (Optional)
                  </label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Any additional information or special requests..."
                    className="min-h-[120px] resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 text-base gradient-primary hover:opacity-90 transition-smooth"
                >
                  {isSubmitting ? (
                    "Booking..."
                  ) : (
                    <>
                      Book Appointment
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center shadow-soft border-border/50 hover:shadow-medium transition-smooth">
              <CardContent className="pt-8 pb-8">
                <div className="w-14 h-14 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                  <Calendar className="h-7 w-7 text-accent-foreground" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Easy Scheduling</h4>
                <p className="text-muted-foreground text-sm">
                  Simple and intuitive appointment booking process
                </p>
              </CardContent>
            </Card>

            <Card className="text-center shadow-soft border-border/50 hover:shadow-medium transition-smooth">
              <CardContent className="pt-8 pb-8">
                <div className="w-14 h-14 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                  <Clock className="h-7 w-7 text-accent-foreground" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Real-time Sync</h4>
                <p className="text-muted-foreground text-sm">
                  Instant synchronization with Google Calendar
                </p>
              </CardContent>
            </Card>

            <Card className="text-center shadow-soft border-border/50 hover:shadow-medium transition-smooth">
              <CardContent className="pt-8 pb-8">
                <div className="w-14 h-14 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                  <Mail className="h-7 w-7 text-accent-foreground" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Email Updates</h4>
                <p className="text-muted-foreground text-sm">
                  Automatic email confirmations and reminders
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 bg-card/30">
        <div className="container mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            © 2025 PAXFORM. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
