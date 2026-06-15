import { toast } from "sonner";

export const notify = {
  success(message: string) {
    toast.dismiss();
    return toast.success(message);
  },
  error(message: string) {
    toast.dismiss();
    return toast.error(message);
  },
};
