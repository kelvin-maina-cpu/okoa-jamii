import { SubmissionResultParams } from '../types/incidents';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Home: undefined;
  ReportIncident: undefined;
  MyReports: undefined;
  IncidentDetails: { incidentId?: string; localId?: string };
  SubmissionResult: SubmissionResultParams;
};
