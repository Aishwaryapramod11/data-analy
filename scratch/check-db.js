import { sequelize, PageEvent, User } from '../server/models.js';

async function check() {
  try {
    await sequelize.authenticate();
    console.log('Database connection OK.');
    
    const usersCount = await User.count();
    const eventsCount = await PageEvent.count();
    
    console.log('Registered Users Count:', usersCount);
    console.log('Logged Analytics Events Count:', eventsCount);
    
    if (eventsCount > 0) {
      const latest = await PageEvent.findOne({ order: [['timestamp', 'DESC']] });
      console.log('Latest event:', latest.toJSON());
    }
  } catch (error) {
    console.error('Error querying DB:', error);
  } finally {
    await sequelize.close();
  }
}

check();
