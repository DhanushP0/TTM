-- This file contains the SQL commands to create the database schema for the application.

-- PostgreSQL database dump
--BUILDING database schema
create table public.buildings (
  id serial not null,
  name character varying(255) not null,
  description text null,
  constraint buildings_pkey primary key (id)
) TABLESPACE pg_default;


--CLASS_STATUS table
create table public.class_status (
  id serial not null,
  status text not null,
  updated_at timestamp without time zone null default now(),
  constraint class_status_pkey primary key (id),
  constraint class_status_status_check check (
    (
      status = any (
        array[
          'scheduled'::text,
          'ongoing'::text,
          'delayed'::text,
          'rescheduled'::text,
          'canceled'::text,
          'ended'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

--CLASSROOM table
create table public.classrooms (
  id serial not null,
  floor_id integer null,
  room_number character varying(50) not null,
  teacher_name character varying(255) null,
  building_id integer null,
  constraint classrooms_pkey primary key (id),
  constraint classrooms_building_id_fkey foreign KEY (building_id) references buildings (id) on delete CASCADE,
  constraint classrooms_floor_id_fkey foreign KEY (floor_id) references floors (id) on delete CASCADE
) TABLESPACE pg_default;

--Department table
create table public.departments (
  id serial not null,
  name character varying(255) not null,
  constraint departments_pkey primary key (id)
) TABLESPACE pg_default;

--floor table
create table public.floors (
  id serial not null,
  building_id integer null,
  floor_number integer not null,
  description text null,
  constraint floors_pkey primary key (id),
  constraint floors_building_id_fkey foreign KEY (building_id) references buildings (id) on delete CASCADE
) TABLESPACE pg_default;

--roles table
create table public.roles (
  id serial not null,
  name text not null,
  constraint roles_pkey primary key (id),
  constraint roles_name_key unique (name)
) TABLESPACE pg_default;

--teachers table
create table public.teachers (
  id serial not null,
  first_name character varying(255) not null,
  last_name character varying(255) not null,
  email character varying(255) not null,
  phone_number character varying(20) null,
  department_id integer null,
  role_id integer null,
  constraint teachers_pkey primary key (id),
  constraint teachers_email_key unique (email),
  constraint teachers_department_id_fkey foreign KEY (department_id) references departments (id) on delete set null,
  constraint teachers_role_id_fkey foreign KEY (role_id) references roles (id)
) TABLESPACE pg_default;

--timetable table
create table public.timetable (
  id serial not null,
  classroom_id integer null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  class_name character varying(255) not null,
  building_id integer null,
  floor_id integer null,
  teacher_id integer null,
  date date not null default CURRENT_DATE,
  class_status_id integer null,
  constraint timetable_pkey primary key (id),
  constraint timetable_building_id_fkey foreign KEY (building_id) references buildings (id) on delete CASCADE,
  constraint timetable_class_status_id_fkey foreign KEY (class_status_id) references class_status (id) on delete set null,
  constraint timetable_classroom_id_fkey foreign KEY (classroom_id) references classrooms (id) on delete CASCADE,
  constraint timetable_floor_id_fkey foreign KEY (floor_id) references floors (id) on delete CASCADE,
  constraint timetable_teacher_id_fkey foreign KEY (teacher_id) references teachers (id) on delete CASCADE
) TABLESPACE pg_default;

