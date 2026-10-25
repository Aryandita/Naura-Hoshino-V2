const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserSurvival = sequelize.define(
  "UserSurvival",
  {
    userId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    // Sukamaju Koin (SC), mata uang komunitas desa & pesisir Sukamaju (era Slice of Life).
    sukamajuCoins: {
      type: DataTypes.INTEGER,
      defaultValue: 500, // Modal awal 500 Sukamaju Koin (SC)
    },
    // Voucher Beasiswa (VB), mata uang prestasi & festival langka (era Slice of Life).
    scholarshipVouchers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // Berlian Adisha (BA), mata uang legendaris endgame dari dunia Adisha.
    adishaDiamonds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    clanId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Virtual alias agar kode yang memanggil nama lama (starFragments & coupons) tetap 100% kompatibel.
    starFragments: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue("sukamajuCoins");
      },
      set(val) {
        this.setDataValue("sukamajuCoins", val);
      },
    },
    coupons: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue("scholarshipVouchers");
      },
      set(val) {
        this.setDataValue("scholarshipVouchers", val);
      },
    },
    lotteryTickets: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastNoviceAidClaimAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    hunger: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
    },
    thirst: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
    },
    hp: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
    },
    stamina: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
    },
    strength: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    agility: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    intelligence: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    luck: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    survival_xp: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    survival_level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    inGameDay: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    inGameHour: {
      type: DataTypes.INTEGER,
      defaultValue: 6,
    },
    propertyId: {
      type: DataTypes.STRING,
      defaultValue: "jalanan",
    },
    currentLocation: {
      type: DataTypes.STRING,
      defaultValue: "jalanan",
    },
    vehicle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    rpg_state: {
      type: DataTypes.JSON,
      defaultValue: {
        sick: false,
        tax_due: 0,
        house_seized: false,
        weather: "cerah",
        weather_hour: 0,
        unlocked_recipes: [],
        failed_exams: 0,
        test_cd: 0,
      },
    },
    shop_purchases: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    shop_last_reset_day: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    storyProgress: {
      type: DataTypes.JSON,
      defaultValue: {
        currentChapter: "prologue",
        currentScene: "start",
        completedScenes: [],
        unlockedBackstories: [],
        choices: {},
        flags: {},
      },
    },
    roamStats: {
      type: DataTypes.JSON,
      defaultValue: {
        totalRoams: 0,
        visitedLocations: [],
        eventsEncountered: 0,
      },
    },
  },
  {
    tableName: "UserSurvivals",
    timestamps: true,
    paranoid: true,
  },
);

module.exports = UserSurvival;
