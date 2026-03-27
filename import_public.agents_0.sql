INSERT INTO public.agents (id, created_at, email, name, role, password, approval_status, phone, address, created_by) VALUES
('409263b0-68db-45c6-b37b-769e6e7f8d0a', '2025-04-23 21:15:09.492416+00', 'MM@GMAIL.COM', 'mm', 'agent', '123456789', 'approved', '01124546845', 'الزقازيق', NULL),
('b576cbfb-458a-4f98-856b-4ef4f8e81618', '2025-04-22 15:18:53.772037+00', 'mohamedamer2004@gmail.com', 'محمد ', 'admin', '01002808714', 'approved', '01002808714', 'سرابيوم الاسماعيليه', NULL),
('cd6456f3-61fb-4012-8065-92f5b8ab1a45', '2025-03-09 05:08:24.148077+00', 'zeero4123@gmail.com', 'Ahmed Mohamed', 'admin', 'azwk3kyP', 'approved', '01026043165', 'سرابيوم الاسماعيلية', '425d40bc-dbbf-4ed2-801d-1c879ff7103d')
ON CONFLICT (id) DO UPDATE SET
  created_at = EXCLUDED.created_at, email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, password = EXCLUDED.password, approval_status = EXCLUDED.approval_status, phone = EXCLUDED.phone, address = EXCLUDED.address, created_by = EXCLUDED.created_by;