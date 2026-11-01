insert into public.exercise_library (
  slug, name, muscle_group, equipment, movement_pattern, sport_relevance, instructions, alternative_slugs, why_template, live_supported
) values
  ('hip_flexor_stretch', 'Half-kneeling hip flexor stretch', 'hips', 'bodyweight', 'mobility', array['running','cycling','strength','triathlon'],
    'Kneel on one knee, tuck the pelvis, and shift forward until the front of the hip stretches. Keep the ribs down.',
    array['hamstring_stretch'], 'Restores hip extension so the next run, ride, or sport session starts from a usable stride.', false),
  ('hamstring_stretch', 'Supine hamstring stretch', 'hamstrings', 'bodyweight', 'mobility', array['running','cycling','strength'],
    'Lie on your back and raise one leg until the hamstring stretches. Keep the other leg long.',
    array['hip_flexor_stretch'], 'Eases the posterior chain after hinging, running, or a long time on the bike.', false),
  ('calf_stretch', 'Standing calf stretch', 'calves', 'bodyweight', 'mobility', array['running','triathlon'],
    'Step one foot back, keep the heel down, and lean until the calf stretches.',
    array['soleus_raise'], 'Gives the calf and Achilles the range they use on every stride.', false),
  ('chest_stretch', 'Doorway chest stretch', 'chest', 'bodyweight', 'mobility', array['strength','swimming','bodybuilding'],
    'Set the forearm on a door frame and turn the chest away until the front of the shoulder stretches.',
    array['shoulder_stretch'], 'Opens the chest after pressing so the shoulders can sit back for the next session.', false),
  ('shoulder_stretch', 'Cross-body shoulder stretch', 'shoulders', 'bodyweight', 'mobility', array['strength','swimming','bodybuilding'],
    'Pull one arm across the chest and keep the shoulder down.',
    array['chest_stretch'], 'Settles the shoulder after pressing, pulling, or a swim.', false)
on conflict (slug) do nothing;
