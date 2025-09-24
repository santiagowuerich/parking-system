# 🗃️ Database Changes for Enhanced Operator Interface

## 📋 Overview

This document outlines all the database changes required to implement the enhanced simple operator interface with vehicle movement tracking, plaza status management, and real-time updates.

## 🎯 Features Implemented

- ✅ **Vehicle Movement Tracking**: Log and track vehicle movements between plazas
- ✅ **Plaza Status Management**: Block/unblock plazas with reason tracking
- ✅ **Real-time Updates**: Live notifications for movements and status changes
- ✅ **Audit Trail**: Complete history of changes with user attribution
- ✅ **Security**: Row Level Security (RLS) policies for data protection

## 📊 New Database Tables

### 1. `vehicle_movements` Table

**Purpose**: Track vehicle movements between plazas within parking lots.

```sql
CREATE TABLE vehicle_movements (
  mov_id SERIAL PRIMARY KEY,
  est_id INTEGER NOT NULL REFERENCES estacionamientos(est_id),
  veh_patente VARCHAR(10) NOT NULL REFERENCES vehiculos(veh_patente),
  pla_origen INTEGER NOT NULL,
  pla_destino INTEGER NOT NULL,
  mov_fecha_hora TIMESTAMP NOT NULL DEFAULT NOW(),
  mov_razon TEXT DEFAULT 'Movimiento manual',
  usu_id INTEGER REFERENCES usuarios(usu_id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Key Features**:
- Foreign key constraints ensure data integrity
- Check constraints prevent moving to the same plaza
- Indexed for optimal query performance
- Soft-deletion safe with user references

### 2. `plaza_status_changes` Table

**Purpose**: Log all plaza status changes (libre, ocupada, mantenimiento, etc.).

```sql
CREATE TABLE plaza_status_changes (
  psc_id SERIAL PRIMARY KEY,
  est_id INTEGER NOT NULL REFERENCES estacionamientos(est_id),
  pla_numero INTEGER NOT NULL,
  psc_estado_anterior VARCHAR(20) NOT NULL,
  psc_estado_nuevo VARCHAR(20) NOT NULL,
  psc_fecha_hora TIMESTAMP NOT NULL DEFAULT NOW(),
  psc_razon TEXT DEFAULT 'Cambio manual',
  usu_id INTEGER REFERENCES usuarios(usu_id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Key Features**:
- Validates status transitions
- Prevents same-state changes
- Tracks who made the change and when
- Includes reason for audit purposes

## 🔧 Required Database Migrations

### Step 1: Run Core Migrations

Execute the following SQL files in order:

1. **`sql/migrations/002_vehicle_movements_and_status_changes.sql`**
   - Creates both new tables
   - Adds necessary indexes and constraints
   - Sets up RLS policies
   - Adds missing `pla_estado` column to `plazas` table if needed

2. **`sql/migrations/003_enable_realtime_for_new_tables.sql`**
   - Enables Supabase Realtime for new tables
   - Creates notification triggers
   - Sets up real-time event publishing

### Step 2: Verification Queries

After running migrations, verify the setup:

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('vehicle_movements', 'plaza_status_changes');

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('vehicle_movements', 'plaza_status_changes');

-- Verify realtime is enabled
SELECT schemaname, tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename IN ('vehicle_movements', 'plaza_status_changes');
```

## 🛡️ Security Implementation

### Row Level Security (RLS) Policies

Both tables have comprehensive RLS policies that ensure:

1. **Users can only access data from their parking lots**
   - Employees can access their assigned parking lot data
   - Owners can access their own parking lot data

2. **Proper permissions for CRUD operations**
   - SELECT: View movements/changes from authorized parking lots
   - INSERT: Create new records for authorized parking lots
   - No UPDATE/DELETE: Maintains audit trail integrity

### Example Policy Structure

```sql
-- Example for vehicle_movements (similar for plaza_status_changes)
CREATE POLICY "Users can view movements from their parkings" ON vehicle_movements
  FOR SELECT USING (
    est_id IN (
      SELECT ee.est_id FROM empleados_estacionamiento ee
      JOIN playeros p ON ee.play_id = p.play_id
      WHERE p.usu_id = auth.uid()
      UNION
      SELECT e.est_id FROM estacionamientos e
      WHERE e.usu_id = auth.uid()
    )
  );
```

## 📡 Real-time Implementation

### Supabase Realtime Setup

The system includes:

1. **Automatic table publication** to `supabase_realtime`
2. **Custom trigger functions** for granular notifications
3. **Structured event payloads** with parking lot context

### Frontend Integration

Update your existing realtime subscriptions in the operator panel:

```typescript
// Add to existing useEffect in OperatorPanel
useEffect(() => {
  const channel = supabase.channel('parking-updates')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'vehicle_movements'
    }, (payload) => {
      console.log('Vehicle movement:', payload)
      fetchPlazasStatus() // Refresh plaza status
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'plaza_status_changes'
    }, (payload) => {
      console.log('Plaza status change:', payload)
      fetchPlazasStatus() // Refresh plaza status
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [estId, fetchPlazasStatus])
```

## 📈 Performance Optimizations

### Indexes Created

The migrations include strategic indexes for optimal performance:

```sql
-- Vehicle movements indexes
CREATE INDEX idx_vehicle_movements_est_id ON vehicle_movements(est_id);
CREATE INDEX idx_vehicle_movements_fecha ON vehicle_movements(mov_fecha_hora DESC);
CREATE INDEX idx_vehicle_movements_patente ON vehicle_movements(veh_patente);
CREATE INDEX idx_vehicle_movements_plazas ON vehicle_movements(est_id, pla_origen, pla_destino);

-- Plaza status changes indexes
CREATE INDEX idx_plaza_status_changes_est_id ON plaza_status_changes(est_id);
CREATE INDEX idx_plaza_status_changes_fecha ON plaza_status_changes(psc_fecha_hora DESC);
CREATE INDEX idx_plaza_status_changes_plaza ON plaza_status_changes(est_id, pla_numero);
```

### Query Optimization Tips

1. **Always filter by `est_id`** in application queries
2. **Use date ranges** when querying historical data
3. **Limit results** for dashboard views
4. **Consider pagination** for large datasets

## 🔍 Useful Views for Reporting

The migrations create helpful views for reporting:

### `vw_vehicle_movements_detailed`
Includes user and parking lot information with movements.

### `vw_plaza_status_changes_detailed`
Includes user and parking lot information with status changes.

Example usage:
```sql
-- Recent movements for a parking lot
SELECT * FROM vw_vehicle_movements_detailed
WHERE est_id = 1
ORDER BY mov_fecha_hora DESC
LIMIT 10;

-- Plaza status changes today
SELECT * FROM vw_plaza_status_changes_detailed
WHERE est_id = 1
AND DATE(psc_fecha_hora) = CURRENT_DATE;
```

## 🧪 Testing the Implementation

### 1. Test Vehicle Movement API

```bash
curl -X POST http://localhost:3000/api/parking/move?est_id=1 \
  -H "Content-Type: application/json" \
  -d '{
    "license_plate": "ABC123",
    "from_plaza": 5,
    "to_plaza": 10,
    "move_time": "2025-01-19T10:30:00Z",
    "reason": "Test movement"
  }'
```

### 2. Test Plaza Status Management API

```bash
curl -X PATCH http://localhost:3000/api/plazas/5/status?est_id=1 \
  -H "Content-Type: application/json" \
  -d '{
    "pla_estado": "Mantenimiento",
    "razon": "Cleaning scheduled"
  }'
```

### 3. Verify Database Records

```sql
-- Check movement was logged
SELECT * FROM vehicle_movements
WHERE veh_patente = 'ABC123'
ORDER BY mov_fecha_hora DESC LIMIT 1;

-- Check status change was logged
SELECT * FROM plaza_status_changes
WHERE pla_numero = 5
ORDER BY psc_fecha_hora DESC LIMIT 1;
```

## 🚨 Troubleshooting

### Common Issues

1. **RLS Policy Errors**
   - Ensure user is properly authenticated
   - Verify user has access to the parking lot
   - Check `empleados_estacionamiento` relationship

2. **Foreign Key Violations**
   - Ensure vehicle exists in `vehiculos` table
   - Verify parking lot exists in `estacionamientos`
   - Check plaza numbers are valid

3. **Realtime Not Working**
   - Verify tables are added to `supabase_realtime` publication
   - Check trigger functions are created
   - Ensure frontend subscription is properly configured

### Debug Queries

```sql
-- Check RLS policies
SELECT * FROM pg_policies
WHERE tablename IN ('vehicle_movements', 'plaza_status_changes');

-- Check realtime publications
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- Check user permissions
SELECT ee.est_id, e.est_nombre
FROM empleados_estacionamiento ee
JOIN estacionamientos e ON ee.est_id = e.est_id
JOIN playeros p ON ee.play_id = p.play_id
WHERE p.usu_id = '[user-id]';
```

## 🔄 Rollback Instructions

If you need to rollback the changes:

```sql
-- Drop new tables (this will remove all data)
DROP TABLE IF EXISTS vehicle_movements CASCADE;
DROP TABLE IF EXISTS plaza_status_changes CASCADE;

-- Remove from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE vehicle_movements;
ALTER PUBLICATION supabase_realtime DROP TABLE plaza_status_changes;

-- Drop trigger functions
DROP FUNCTION IF EXISTS notify_vehicle_movement() CASCADE;
DROP FUNCTION IF EXISTS notify_plaza_status_change() CASCADE;

-- Drop views
DROP VIEW IF EXISTS vw_vehicle_movements_detailed;
DROP VIEW IF EXISTS vw_plaza_status_changes_detailed;
```

## 📞 Support

If you encounter issues:

1. Check the migration logs for error details
2. Verify your Supabase project has the necessary permissions
3. Ensure your database user has the required privileges
4. Review the RLS policies if access is denied

---

**✅ Implementation Complete**: After following this guide, your parking system will have enhanced operator capabilities with complete audit trails and real-time updates.