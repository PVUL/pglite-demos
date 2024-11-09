export const seed = async (db) => {
    await db.query(
      `INSERT INTO test (title) values 
      ('Hello world'),
      ('paul was here')`
    );
  };