import * as yup from "yup";

export const scrapeSchema = yup.object({
  states: yup
    .array()
    .of(yup.string().required())
    .min(1, "Select at least one state")
    .required("Select at least one state"),
  sports: yup
    .array()
    .of(yup.string().required())
    .min(1, "Select at least one sport")
    .required("Select at least one sport"),
});
