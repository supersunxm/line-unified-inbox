-- Employee IDs are optional for legacy users but unique whenever present.
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
