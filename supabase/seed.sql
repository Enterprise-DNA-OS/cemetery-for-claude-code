-- Fictional demo: two cemeteries, four sections, nineteen plots, ten people in the
-- register or booked. Dates are relative to today so there is always a right about
-- to lapse, a booking short of paperwork and an account overdue.
-- Runs once: a second run changes nothing.
do $$
begin
  if exists (select 1 from cemeteries where id = 'c0000001-0000-4000-8000-000000000001') then
    return;
  end if;

  insert into cemeteries (id, name, code, address, closed_on) values
    ('c0000001-0000-4000-8000-000000000001', 'Example Lawn Cemetery', 'ELC', '200 Sample Road, Example Bay', null),
    ('c0000002-0000-4000-8000-000000000002', 'Old Town Cemetery', 'OTC', 'Church Street, Example Bay', '1990-06-30');

  insert into sections (id, cemetery_id, name, kind, right_fee_cents, interment_fee_cents) values
    ('5e000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', 'Lawn A', 'lawn', 380000, 145000),
    ('5e000002-0000-4000-8000-000000000002', 'c0000001-0000-4000-8000-000000000001', 'Ashes Garden', 'ashes', 95000, 35000),
    ('5e000003-0000-4000-8000-000000000003', 'c0000001-0000-4000-8000-000000000001', 'Natural', 'natural', 320000, 145000),
    ('5e000004-0000-4000-8000-000000000004', 'c0000002-0000-4000-8000-000000000002', 'Block 3', 'monumental', 0, 120000);

  insert into plots (id, section_id, row_label, number, plot_type, capacity, unusable_reason) values
    ('a0000001-0000-4000-8000-000000000001', '5e000001-0000-4000-8000-000000000001', 'A', '1', 'burial', 2, null),
    ('a0000002-0000-4000-8000-000000000002', '5e000001-0000-4000-8000-000000000001', 'A', '2', 'burial', 2, null),
    ('a0000003-0000-4000-8000-000000000003', '5e000001-0000-4000-8000-000000000001', 'A', '3', 'burial', 2, null),
    ('a0000004-0000-4000-8000-000000000004', '5e000001-0000-4000-8000-000000000001', 'A', '4', 'burial', 2, null),
    ('a0000005-0000-4000-8000-000000000005', '5e000001-0000-4000-8000-000000000001', 'A', '5', 'burial', 2, null),
    ('a0000006-0000-4000-8000-000000000006', '5e000001-0000-4000-8000-000000000001', 'A', '6', 'burial', 2, null),
    ('a0000007-0000-4000-8000-000000000007', '5e000001-0000-4000-8000-000000000001', 'A', '7', 'burial', 2, null),
    ('a0000008-0000-4000-8000-000000000008', '5e000001-0000-4000-8000-000000000001', 'A', '8', 'burial', 2, null),
    ('a0000009-0000-4000-8000-000000000009', '5e000002-0000-4000-8000-000000000002', 'R1', '1', 'ashes', 4, null),
    ('a0000010-0000-4000-8000-000000000010', '5e000002-0000-4000-8000-000000000002', 'R1', '2', 'ashes', 4, null),
    ('a0000011-0000-4000-8000-000000000011', '5e000002-0000-4000-8000-000000000002', 'R1', '3', 'ashes', 4, null),
    ('a0000012-0000-4000-8000-000000000012', '5e000002-0000-4000-8000-000000000002', 'R1', '4', 'ashes', 4, null),
    ('a0000013-0000-4000-8000-000000000013', '5e000003-0000-4000-8000-000000000003', 'N', '1', 'burial', 1, null),
    ('a0000014-0000-4000-8000-000000000014', '5e000003-0000-4000-8000-000000000003', 'N', '2', 'burial', 1, null),
    ('a0000015-0000-4000-8000-000000000015', '5e000003-0000-4000-8000-000000000003', 'N', '3', 'burial', 1, null),
    ('a0000016-0000-4000-8000-000000000016', '5e000004-0000-4000-8000-000000000004', '3', '14', 'burial', 2, null),
    ('a0000017-0000-4000-8000-000000000017', '5e000004-0000-4000-8000-000000000004', '3', '15', 'burial', 2, null),
    ('a0000018-0000-4000-8000-000000000018', '5e000004-0000-4000-8000-000000000004', '3', '16', 'burial', 2, null),
    ('a0000019-0000-4000-8000-000000000019', '5e000004-0000-4000-8000-000000000004', '3', '17', 'burial', 2, 'Tree roots under the plot');

  insert into holders (id, name, email, phone, address) values
    ('b0000001-0000-4000-8000-000000000001', 'Margaret Hale', 'margaret@example.com', '021 000 0101', '4 Example Street, Example Bay'),
    ('b0000002-0000-4000-8000-000000000002', 'Wiremu Tane', 'wiremu@example.com', '021 000 0102', '18 Sample Road, Example Bay'),
    ('b0000003-0000-4000-8000-000000000003', 'Ruth Simmons', null, '03 000 0103', '7 Old Mill Lane, Example Bay'),
    ('b0000004-0000-4000-8000-000000000004', 'Peter Grant', 'peter@example.com', null, '22 Harbour View, Example City'),
    ('b0000005-0000-4000-8000-000000000005', 'Ana Lealaiauloto', 'ana@example.com', '021 000 0105', '9 Kowhai Crescent, Example Bay');

  insert into funeral_directors (id, name, email, phone) values
    ('f0000001-0000-4000-8000-000000000001', 'Harbour Funeral Services', 'office@harbour.example.com', '03 000 0201'),
    ('f0000002-0000-4000-8000-000000000002', 'Valley Funerals', 'bookings@valley.example.com', '03 000 0202'),
    ('f0000003-0000-4000-8000-000000000003', 'Kowhai Funeral Home', 'kowhai@example.com', '03 000 0203');

  insert into rights (id, plot_id, holder_id, certificate_no, purchased_on, term_years, price_cents) values
    ('e0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'ELC-0412', current_date - interval '6 years 20 days', null, 380000),
    ('e0000002-0000-4000-8000-000000000002', 'a0000002-0000-4000-8000-000000000002', 'b0000002-0000-4000-8000-000000000002', 'ELC-0466', current_date - interval '2 years', null, 380000),
    ('e0000003-0000-4000-8000-000000000003', 'a0000016-0000-4000-8000-000000000016', 'b0000003-0000-4000-8000-000000000003', 'OTC-1966-031', current_date - interval '59 years 30 days', null, 0),
    ('e0000004-0000-4000-8000-000000000004', 'a0000017-0000-4000-8000-000000000017', 'b0000004-0000-4000-8000-000000000004', 'OTC-1955-009', current_date - interval '70 years', null, 0),
    ('e0000005-0000-4000-8000-000000000005', 'a0000009-0000-4000-8000-000000000009', 'b0000005-0000-4000-8000-000000000005', 'ELC-0450', current_date - interval '3 years', 2, 95000),
    ('e0000006-0000-4000-8000-000000000006', 'a0000004-0000-4000-8000-000000000004', 'b0000003-0000-4000-8000-000000000003', 'ELC-0478', current_date - interval '1 year', null, 380000);

  insert into deceased (id, name, date_of_birth, date_of_death, age_years, last_address, occupation) values
    ('d0000001-0000-4000-8000-000000000001', 'George Hale', current_date - interval '84 years', current_date - interval '6 years 9 days', 77, '4 Example Street, Example Bay', 'Engineer'),
    ('d0000002-0000-4000-8000-000000000002', 'Ellen Grant', current_date - interval '131 years', current_date - interval '62 years 5 days', 68, 'Church Street, Example Bay', 'Teacher'),
    ('d0000003-0000-4000-8000-000000000003', 'Thomas Reid', current_date - interval '120 years', current_date - interval '40 years 4 days', 79, '3 Wharf Road, Example Bay', 'Farmer'),
    ('d0000004-0000-4000-8000-000000000004', 'Joan Park', current_date - interval '88 years', current_date - interval '94 days', 87, '11 Rimu Street, Example Bay', null),
    ('d0000005-0000-4000-8000-000000000005', 'Ivy Moana', current_date - interval '91 years', current_date - interval '30 days', 90, '9 Kowhai Crescent, Example Bay', null),
    ('d0000006-0000-4000-8000-000000000006', 'Frank Doyle', current_date - interval '73 years', current_date - interval '14 days', 72, '50 Totara Road, Example Bay', 'Builder'),
    ('d0000007-0000-4000-8000-000000000007', 'Sam Ward', current_date - interval '66 years', current_date - interval '205 days', 65, '2 Beach Road, Example Bay', null),
    ('d0000008-0000-4000-8000-000000000008', 'Hemi Tane', current_date - interval '81 years', current_date - interval '3 days', 80, '18 Sample Road, Example Bay', null),
    ('d0000009-0000-4000-8000-000000000009', 'Lorna Bell', current_date - interval '77 years', current_date - interval '2 days', 76, '6 Matai Place, Example Bay', null),
    ('d0000010-0000-4000-8000-000000000010', 'Arthur Penn', current_date - interval '95 years', current_date - interval '4 days', 94, 'Example Rest Home, Example Bay', null);

  insert into interments (id, plot_id, deceased_id, funeral_director_id, kind, scheduled_at, status, holder_consent_on, paperwork_on, completed_on, register_no) values
    ('10000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'd0000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-000000000001', 'burial', (current_date - interval '6 years 3 days') + time '11:00', 'completed', current_date - interval '6 years 7 days', current_date - interval '6 years 5 days', current_date - interval '6 years 3 days', 101),
    ('10000002-0000-4000-8000-000000000002', 'a0000017-0000-4000-8000-000000000017', 'd0000002-0000-4000-8000-000000000002', null, 'burial', (current_date - interval '62 years') + time '14:00', 'completed', null, null, current_date - interval '62 years', 12),
    ('10000003-0000-4000-8000-000000000003', 'a0000018-0000-4000-8000-000000000018', 'd0000003-0000-4000-8000-000000000003', null, 'burial', (current_date - interval '40 years') + time '13:00', 'completed', null, null, current_date - interval '40 years', 31),
    ('10000004-0000-4000-8000-000000000004', 'a0000005-0000-4000-8000-000000000005', 'd0000004-0000-4000-8000-000000000004', 'f0000001-0000-4000-8000-000000000001', 'burial', (current_date - interval '90 days') + time '13:30', 'completed', null, current_date - interval '92 days', current_date - interval '90 days', 102),
    ('10000005-0000-4000-8000-000000000005', 'a0000010-0000-4000-8000-000000000010', 'd0000005-0000-4000-8000-000000000005', 'f0000003-0000-4000-8000-000000000003', 'ashes', (current_date - interval '20 days') + time '10:00', 'completed', null, current_date - interval '22 days', current_date - interval '20 days', 103),
    ('10000006-0000-4000-8000-000000000006', 'a0000013-0000-4000-8000-000000000013', 'd0000006-0000-4000-8000-000000000006', 'f0000002-0000-4000-8000-000000000002', 'burial', (current_date - interval '10 days') + time '11:00', 'completed', null, current_date - interval '12 days', current_date - interval '10 days', null),
    ('10000007-0000-4000-8000-000000000007', 'a0000006-0000-4000-8000-000000000006', 'd0000007-0000-4000-8000-000000000007', 'f0000001-0000-4000-8000-000000000001', 'burial', (current_date - interval '200 days') + time '14:00', 'removed', null, current_date - interval '202 days', current_date - interval '200 days', 104),
    ('10000008-0000-4000-8000-000000000008', 'a0000002-0000-4000-8000-000000000002', 'd0000008-0000-4000-8000-000000000008', 'f0000001-0000-4000-8000-000000000001', 'burial', (current_date + 2) + time '11:00', 'booked', null, current_date - 1, null, null),
    ('10000009-0000-4000-8000-000000000009', 'a0000014-0000-4000-8000-000000000014', 'd0000009-0000-4000-8000-000000000009', 'f0000002-0000-4000-8000-000000000002', 'burial', date_trunc('hour', now()::timestamp + interval '12 hours'), 'booked', null, null, null, null),
    ('10000010-0000-4000-8000-000000000010', 'a0000011-0000-4000-8000-000000000011', 'd0000010-0000-4000-8000-000000000010', 'f0000003-0000-4000-8000-000000000003', 'ashes', (current_date + 5) + time '14:00', 'booked', null, current_date, null, null);

  insert into disinterments (interment_id, licence_ref, done_on, destination) values
    ('10000007-0000-4000-8000-000000000007', null, current_date - 30, 'Family plot, Example City Cemetery');

  insert into memorials (plot_id, applicant, description, applied_on, decision, decided_on, installed_on, condition, inspected_on) values
    ('a0000001-0000-4000-8000-000000000001', 'Southern Memorials', 'Black granite headstone', current_date - interval '5 years 10 months', 'approved', current_date - interval '5 years 9 months', current_date - interval '5 years 6 months', 'safe', current_date - 100),
    ('a0000017-0000-4000-8000-000000000017', 'Unknown', 'Marble headstone and kerb', null, 'approved', null, current_date - interval '61 years', 'unsafe', current_date - 30),
    ('a0000005-0000-4000-8000-000000000005', 'Southern Memorials', 'Bronze plaque on the lawn beam', current_date - 40, null, null, null, 'not inspected', null),
    ('a0000010-0000-4000-8000-000000000010', 'Moana whanau', 'Small upright plaque', null, null, null, current_date - 5, 'not inspected', null);

  insert into grounds_jobs (section_id, plot_id, category, summary, reported_on) values
    ('5e000001-0000-4000-8000-000000000001', 'a0000005-0000-4000-8000-000000000005', 'sunken grave', 'Grave has settled about 15 cm, needs topping up and reseeding', current_date - 21),
    ('5e000003-0000-4000-8000-000000000003', 'a0000014-0000-4000-8000-000000000014', 'drainage', 'Water ponding beside N-2 after rain', current_date - 3);

  insert into charges (funeral_director_id, holder_id, interment_id, right_id, description, amount_cents, raised_on, due_on) values
    ('f0000001-0000-4000-8000-000000000001', null, '10000004-0000-4000-8000-000000000004', null, 'Interment fee: Joan Park, ELC Lawn A A-5', 145000, current_date - 90, current_date - 70),
    ('f0000001-0000-4000-8000-000000000001', null, '10000008-0000-4000-8000-000000000008', null, 'Interment fee: Hemi Tane, ELC Lawn A A-2', 145000, current_date - 1, current_date + 19),
    ('f0000002-0000-4000-8000-000000000002', null, '10000006-0000-4000-8000-000000000006', null, 'Interment fee: Frank Doyle, ELC Natural N-1', 145000, current_date - 10, current_date + 10),
    ('f0000003-0000-4000-8000-000000000003', null, '10000005-0000-4000-8000-000000000005', null, 'Interment fee: Ivy Moana, ELC Ashes Garden R1-2', 35000, current_date - 20, current_date),
    ('f0000003-0000-4000-8000-000000000003', null, '10000010-0000-4000-8000-000000000010', null, 'Interment fee: Arthur Penn, ELC Ashes Garden R1-3', 35000, current_date, current_date + 20),
    (null, 'b0000003-0000-4000-8000-000000000003', null, 'e0000006-0000-4000-8000-000000000006', 'Right of burial ELC-0478: ELC Lawn A A-4', 380000, current_date - 365, current_date - 345);

  insert into payments (funeral_director_id, holder_id, amount_cents, received_on, reference) values
    ('f0000003-0000-4000-8000-000000000003', null, 35000, current_date - 2, 'KFH 2231'),
    (null, 'b0000003-0000-4000-8000-000000000003', 380000, current_date - 350, 'SIMMONS PLOT');
end $$;
