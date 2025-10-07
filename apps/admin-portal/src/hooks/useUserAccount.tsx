import { fetchPostData } from '@/utils/fetchUtil';

const useUserAccount = () => {
  async function getUserAccountByID(id: string) {
    try {
      const data = await fetchPostData('../UserAccountController/getUserAccountByID', { id });
      console.log(data);
      return data;
    } catch (err) {
      console.log(err);
    }
  }

  return {
    getUserAccountByID,
  };
};

export default useUserAccount;
